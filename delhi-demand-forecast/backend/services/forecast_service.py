"""System demand forecast: trained model when available, heuristic otherwise.

Heuristic fallback = average of the same hour over the last 7 days, adjusted
by the configured temperature sensitivity for the forecast temperature, with
a fixed +/-5 % band that widens with lead time. It is labelled
``forecast_method = "heuristic"`` so the UI never presents it as a model.
"""

from __future__ import annotations

from datetime import timedelta

import numpy as np
import pandas as pd

from backend.config import COMFORT_BAND_C, SENSITIVITY_MW_PER_DEGC, settings
from backend.services.data_store import store
from backend.utils.time import iso, mw

HEURISTIC_BAND_FRAC = 0.05
HEURISTIC_BAND_GROWTH = 0.002


def _future_weather(origin: pd.Timestamp, horizon: int) -> pd.DataFrame:
    fw = store.future_weather
    ts = pd.date_range(origin + timedelta(hours=1), periods=horizon, freq="h")
    out = pd.DataFrame({"timestamp": ts})
    if fw is not None:
        out = out.merge(fw, on="timestamp", how="left")
    for col in ("temperature_c", "humidity", "wind_speed"):
        if col not in out.columns:
            out[col] = np.nan
        last = store.history[col].dropna().iloc[-1] if col in store.history and store.history[col].notna().any() else np.nan
        out[col] = out[col].ffill().fillna(last)
    return out


def _heuristic_forecast(history: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    hist = history.dropna(subset=["demand_mw"]).tail(24 * 7)
    by_hour = hist.groupby(hist["timestamp"].dt.hour)["demand_mw"].mean()
    temp_by_hour = hist.groupby(hist["timestamp"].dt.hour)["temperature_c"].mean() if "temperature_c" in hist else None
    preds = []
    for i, row in weather.iterrows():
        h = row["timestamp"].hour
        base = float(by_hour.get(h, hist["demand_mw"].mean()))
        if temp_by_hour is not None and pd.notna(row.get("temperature_c")):
            ref = float(temp_by_hour.get(h, row["temperature_c"]))
            # Only temperatures above the comfort band add cooling load.
            delta = max(row["temperature_c"], COMFORT_BAND_C[1]) - max(ref, COMFORT_BAND_C[1])
            base += SENSITIVITY_MW_PER_DEGC * delta
        preds.append(base)
    preds = np.array(preds)
    lead = np.arange(1, len(preds) + 1)
    band = preds * (HEURISTIC_BAND_FRAC + HEURISTIC_BAND_GROWTH * lead)
    out = weather.copy()
    out["predicted_mw"], out["lower_mw"], out["upper_mw"] = preds, preds - band, preds + band
    return out


def forecast_frame(horizon: int, temp_delta_c: float = 0.0) -> tuple[pd.DataFrame, str]:
    """Return (frame, method). Frame columns: timestamp, predicted_mw, lower_mw,
    upper_mw, temperature_c, humidity, wind_speed. Cached per (horizon, delta, model)."""
    predictor = store.predictor
    key = ("forecast", horizon, round(temp_delta_c, 2), id(predictor), str(store.origin))
    cached = store.cache_get(key)
    if cached is not None:
        return cached
    weather = _future_weather(store.origin, horizon)
    if temp_delta_c:
        weather["temperature_c"] = weather["temperature_c"] + temp_delta_c
    if predictor is not None:
        try:
            frame = predictor.predict_horizon(store.history, weather, horizon)
            frame = frame.merge(weather[["timestamp", "humidity", "wind_speed"]], on="timestamp", how="left", suffixes=("", "_w"))
            for c in ("humidity", "wind_speed"):
                if c not in frame.columns and f"{c}_w" in frame.columns:
                    frame[c] = frame[f"{c}_w"]
            result = (frame, "ml_model")
        except Exception:  # model failure must not take the API down
            result = (_heuristic_forecast(store.history, weather), "heuristic")
    else:
        result = (_heuristic_forecast(store.history, weather), "heuristic")
    store.cache_set(key, result)
    return result


def peak_of(frame: pd.DataFrame, col: str = "predicted_mw") -> dict:
    i = frame[col].idxmax()
    return {"ts": iso(frame.loc[i, "timestamp"]), "predicted_mw": mw(frame.loc[i, col])}


def build_forecast_response(horizon: int, capacity_mw: float | None = None) -> dict:
    frame, method = forecast_frame(horizon)
    capacity = float(capacity_mw or settings.capacity_mw)
    points = [
        {
            "ts": iso(r.timestamp),
            "predicted_mw": mw(r.predicted_mw),
            "lower_mw": mw(r.lower_mw),
            "upper_mw": mw(r.upper_mw),
            "temp_c": round(float(r.temperature_c), 1) if pd.notna(r.temperature_c) else None,
            "humidity": round(float(r.humidity), 1) if pd.notna(r.humidity) else None,
        }
        for r in frame.itertuples()
    ]
    predictor = store.predictor
    return {
        "generated_at": iso(store.origin),
        "horizon_hours": horizon,
        "data_source": store.history_source,
        "grid_capacity_mw": mw(capacity),
        "forecast_method": method,
        "model_name": predictor.model_name if (predictor and method == "ml_model") else None,
        "model_data_source": predictor.data_source if (predictor and method == "ml_model") else None,
        "weather_source": store.weather_source,
        "interval_label": (
            "Empirical P10-P90 band from validation residuals, widened with lead time"
            if method == "ml_model" else "Heuristic +/-5 % band (no trained model)"
        ),
        "peak": peak_of(frame),
        "points": points,
    }
