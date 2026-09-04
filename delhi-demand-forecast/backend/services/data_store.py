"""In-memory application state, loaded once at startup.

Holds the cleaned history (REAL from CSV or SIMULATED demo), the weather
forecast frame (LIVE / CACHE / DEMO / HISTORICAL_ANALOG), and the trained
model if one is available. Services read from here; nothing else touches
disk at request time.

Provenance rules:
* ``history_source`` is "real" only when a CSV was loaded via settings.
* ``forecast_method`` is "ml_model" only when a trained artifact is loaded;
  otherwise the heuristic fallback is used and labelled as such.
* A model trained on demo data carries ``data_source = "demo"`` in its
  metadata and the API surfaces that, so simulated-data models are never
  mistaken for models trained on real Delhi load.
"""

from __future__ import annotations

import logging
import threading
from datetime import timedelta
from typing import Any

import pandas as pd

from backend.config import settings
from backend.services import weather_service
from backend.utils.time import now_ist, to_ist
from ml.data.loader import DatasetReport, clean_history, load_history_csv
from ml.demo_data import generate_demo_history, generate_demo_weather
from ml.inference.predictor import DemandPredictor

log = logging.getLogger(__name__)


class DataStore:
    def __init__(self) -> None:
        self.history: pd.DataFrame | None = None
        self.history_source: str = "demo"  # "real" | "demo"
        self.dataset_report: DatasetReport | None = None
        self.future_weather: pd.DataFrame | None = None
        self.weather_source: str = "demo"  # live | cache | demo | historical_analog
        self.weather_fetched_at: str | None = None
        self.weather_error: str | None = None
        self.predictor: DemandPredictor | None = None
        self.model_status: str = "absent"  # absent | loading | training | loaded | failed
        self.model_error: str | None = None
        self.loaded_at: str | None = None
        self._lock = threading.Lock()
        self._cache: dict[tuple, Any] = {}

    # ------------------------------------------------------------------ #
    @property
    def origin(self) -> pd.Timestamp:
        """Forecast origin = last hour with actual data."""
        return to_ist(self.history["timestamp"].iloc[-1])

    @property
    def is_demo(self) -> bool:
        return self.history_source == "demo"

    def cache_get(self, key: tuple):
        return self._cache.get(key)

    def cache_set(self, key: tuple, value) -> None:
        if len(self._cache) > 64:
            self._cache.clear()
        self._cache[key] = value

    def invalidate(self) -> None:
        self._cache.clear()

    # ------------------------------------------------------------------ #
    def load(self) -> None:
        now = now_ist()
        self._load_history(now)
        self._load_weather(now)
        self._load_model()
        self.loaded_at = now.isoformat()
        self.invalidate()

    def _load_history(self, now) -> None:
        csv = settings.history_csv
        if csv and csv.exists():
            try:
                self.history, self.dataset_report = load_history_csv(csv)
                self.history_source = "real"
                log.info("Loaded REAL history from %s (%s rows)", csv, len(self.history))
                return
            except Exception as exc:
                log.error("Failed to load %s: %s -- falling back to DEMO data", csv, exc)
        hist, _ = generate_demo_history(now, days=settings.demo_history_days)
        self.history, self.dataset_report = clean_history(hist, source="simulated demo generator")
        self.history_source = "demo"
        log.info("DEMO MODE: simulated history %s -> %s", self.history["timestamp"].iloc[0], self.origin)

    def _load_weather(self, now) -> None:
        horizon = settings.max_horizon_hours
        origin = self.origin
        # Live weather only makes sense when the history ends near the wall clock.
        if abs((to_ist(now) - origin).total_seconds()) <= 48 * 3600:
            res = weather_service.get_weather_forecast()
            self.weather_error = res.error
            if res.frame is not None:
                fut = res.frame[res.frame["timestamp"] > origin].head(horizon)
                if len(fut) >= 24:
                    self.future_weather, self.weather_source, self.weather_fetched_at = fut.reset_index(drop=True), res.source, res.fetched_at
                    return
        if self.is_demo:
            _, fut = generate_demo_history(now, days=settings.demo_history_days, future_hours=horizon)
            self.future_weather, self.weather_source = fut, "demo"
        else:
            self.future_weather, self.weather_source = self._historical_analog_weather(horizon), "historical_analog"

    def _historical_analog_weather(self, horizon: int) -> pd.DataFrame:
        """Same hours one year earlier (52 weeks, keeps weekday alignment)."""
        cols = [c for c in ("temperature_c", "humidity", "wind_speed") if c in self.history.columns]
        future_ts = pd.date_range(self.origin + timedelta(hours=1), periods=horizon, freq="h")
        analog = self.history.set_index("timestamp")[cols].reindex(future_ts - pd.Timedelta(weeks=52))
        analog = analog.ffill().bfill()
        analog.index = future_ts
        return analog.reset_index().rename(columns={"index": "timestamp"})

    def _load_model(self) -> None:
        path = settings.model_path if (settings.model_path.exists() and not self.is_demo) else None
        if path is None and settings.demo_model_path.exists():
            path = settings.demo_model_path
        if path is not None:
            try:
                self.predictor = DemandPredictor.load(path)
                self.model_status = "loaded"
                log.info("Model loaded from %s (%s, trained on %s data)", path, self.predictor.model_name, self.predictor.data_source)
                return
            except Exception as exc:
                self.model_status, self.model_error = "failed", str(exc)
                log.error("Could not load model %s: %s", path, exc)
        if self.is_demo and settings.auto_train_demo:
            self.model_status = "training"
            threading.Thread(target=self._train_demo_model, name="demo-trainer", daemon=True).start()

    def _train_demo_model(self) -> None:
        """Background training on the simulated history; API serves the heuristic meanwhile."""
        try:
            from ml.training.train import TrainConfig, save_artifact, train_from_dataframe

            cfg = TrainConfig(data_source="demo", notes="Trained on simulated demo history at startup.")
            result = train_from_dataframe(self.history, cfg)
            result.metadata["dataset_report"] = self.dataset_report.to_dict()
            save_artifact(result, settings.demo_model_path)
            with self._lock:
                self.predictor = DemandPredictor.load(settings.demo_model_path)
                self.model_status = "loaded"
                self.invalidate()
            log.info("Demo model trained (%s, MAE %.1f MW)", result.model_name, result.metrics["model_mae"])
        except Exception as exc:
            self.model_status, self.model_error = "failed", str(exc)
            log.exception("Demo model training failed")


store = DataStore()
