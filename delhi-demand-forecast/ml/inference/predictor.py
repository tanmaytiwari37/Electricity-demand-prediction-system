"""Multi-step demand forecasting from a saved artifact.

Recursive strategy: forecast hour h+1 from real history, append the
prediction, forecast h+2 using it as ``lag_1h`` and so on. Lags of 24 h and
168 h come from real history for the first day/week and from earlier
predictions beyond that. Weather features for future hours come from the
weather forecast frame the caller supplies.

Prediction band = point forecast + empirical P10/P90 of the model's recent
out-of-sample *recursive* residuals, calibrated separately for every lead hour
(``lead_quantiles`` in the artifact; see ``ml.evaluation.calibration``). No
global widening factor. Beyond the last calibrated lead the band is held at
that lead's width and the label says so. The band always contains the point
forecast (a biased residual quantile can only widen it, never cut it off).
Artifacts without ``lead_quantiles`` fall back to the legacy 1-step band
widened by +1 % per lead hour.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from ml.calendar import holidays_for_range
from ml.features import add_calendar_features, add_weather_features
from ml.schema import TARGET, TIMESTAMP, WEATHER_COLUMNS

BAND_GROWTH_PER_HOUR = 0.01  # legacy fallback only: +1 % band width per lead hour
MIN_HISTORY_HOURS = 168


class ForecastFrame(pd.DataFrame):
    """Marker type: columns ts, predicted_mw, lower_mw, upper_mw (+ weather)."""


class DemandPredictor:
    def __init__(self, artifact: dict[str, Any]):
        self.model = artifact["model"]
        self.model_name: str = artifact["model_name"]
        self.feature_columns: list[str] = artifact["feature_columns"]
        self.metrics: dict = artifact.get("metrics", {})
        self.feature_importance: list[dict] = artifact.get("feature_importance", [])
        self.residual_quantiles: dict = artifact.get("residual_quantiles", {"p10": 0.0, "p90": 0.0})
        self.lead_quantiles: dict | None = artifact.get("lead_quantiles") or None
        self.metadata: dict = artifact.get("metadata", {})

    @classmethod
    def load(cls, path: str | Path) -> "DemandPredictor":
        return cls(joblib.load(path))

    @property
    def data_source(self) -> str:
        return self.metadata.get("data_source", "unknown")

    @property
    def band_method(self) -> str:
        return "per_lead" if self.lead_quantiles else "legacy_widened"

    @property
    def calibrated_horizon(self) -> int:
        return len(self.lead_quantiles["p10"]) if self.lead_quantiles else 0

    # ------------------------------------------------------------------ #
    def predict_horizon(self, history: pd.DataFrame, future_weather: pd.DataFrame | None, horizon: int) -> pd.DataFrame:
        """history: cleaned hourly frame with timestamp + demand_mw (+ weather).
        future_weather: frame with timestamp + weather columns for the horizon."""
        hist = history.dropna(subset=[TARGET]).sort_values(TIMESTAMP).tail(24 * 21).reset_index(drop=True)
        if len(hist) < MIN_HISTORY_HOURS:
            raise ValueError(f"Need at least {MIN_HISTORY_HOURS} hours of history, got {len(hist)}")

        origin = hist[TIMESTAMP].iloc[-1]
        future_ts = pd.date_range(origin + pd.Timedelta(hours=1), periods=horizon, freq="h")

        future = pd.DataFrame({TIMESTAMP: future_ts})
        if future_weather is not None and not future_weather.empty:
            fw = future_weather.copy()
            fw[TIMESTAMP] = pd.to_datetime(fw[TIMESTAMP]).dt.floor("h")
            future = future.merge(fw, on=TIMESTAMP, how="left")
        # Persist last known weather when the forecast frame does not cover an hour.
        for col in WEATHER_COLUMNS + ("solar_generation_mw",):
            if col in hist.columns:
                if col not in future.columns:
                    future[col] = np.nan
                future[col] = future[col].ffill().fillna(hist[col].iloc[-1] if hist[col].notna().any() else 0.0)
        future[TARGET] = np.nan

        frame = pd.concat([hist, future], ignore_index=True)
        years = frame[TIMESTAMP].dt.year
        hol = holidays_for_range(int(years.min()), int(years.max()))
        frame = add_calendar_features(frame, hol)
        frame = add_weather_features(frame)

        y = frame[TARGET].to_numpy(dtype=float, copy=True)  # pandas 3 CoW returns a read-only view
        n_hist = len(hist)
        preds = np.empty(horizon)
        for i in range(horizon):
            k = n_hist + i
            row = frame.iloc[k]
            feats = {}
            for c in self.feature_columns:
                if c == "lag_1h":
                    feats[c] = y[k - 1]
                elif c == "lag_24h":
                    feats[c] = y[k - 24]
                elif c == "lag_168h":
                    feats[c] = y[k - 168]
                elif c == "rolling_mean_24h":
                    feats[c] = np.nanmean(y[k - 24:k])
                elif c == "rolling_mean_168h":
                    feats[c] = np.nanmean(y[k - 168:k])
                else:
                    feats[c] = row[c]
            X = pd.DataFrame([feats], columns=self.feature_columns).astype(float)
            preds[i] = float(self.model.predict(X)[0])
            y[k] = preds[i]

        lead = np.arange(1, horizon + 1)
        if self.lead_quantiles:
            p10s, p90s = np.asarray(self.lead_quantiles["p10"], float), np.asarray(self.lead_quantiles["p90"], float)
            idx = np.minimum(lead - 1, len(p10s) - 1)  # hold the last calibrated lead flat beyond it
            lower = preds + np.minimum(p10s[idx], 0.0)
            upper = preds + np.maximum(p90s[idx], 0.0)
        else:
            widen = 1 + BAND_GROWTH_PER_HOUR * lead
            p10, p90 = self.residual_quantiles.get("p10", 0.0), self.residual_quantiles.get("p90", 0.0)
            lower, upper = preds + p10 * widen, preds + p90 * widen
        out = pd.DataFrame({TIMESTAMP: future_ts, "predicted_mw": preds, "lower_mw": lower, "upper_mw": upper})
        for col in WEATHER_COLUMNS:
            if col in future.columns:
                out[col] = future[col].to_numpy()
        return out
