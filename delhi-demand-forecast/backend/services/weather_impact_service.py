"""Temperature-load relationship computed from the loaded history.

Correlation and sensitivity are *descriptive statistics of the dataset*
(real or simulated), not causal claims. Sensitivity is the OLS slope of
demand on temperature restricted to hours above the comfort band.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from backend.config import COMFORT_BAND_C
from backend.services.data_store import store

BIN_WIDTH_C = 2.0
MIN_HOURS_PER_BIN = 12


def build_weather_impact_response() -> dict:
    key = ("weather_impact", str(store.origin))
    cached = store.cache_get(key)
    if cached is not None:
        return cached

    hist = store.history.dropna(subset=["demand_mw"])
    if "temperature_c" not in hist.columns or hist["temperature_c"].notna().sum() < 100:
        resp = {
            "correlation_temp_load": None, "sensitivity_mw_per_degc": None,
            "comfort_band_c": list(COMFORT_BAND_C), "data_source": store.history_source,
            "scatter": [], "n_hours": int(len(hist)), "note": "No temperature data in the loaded history.",
        }
        store.cache_set(key, resp)
        return resp

    df = hist[["temperature_c", "demand_mw"]].dropna()
    # Afternoon hours isolate the cooling response from the diurnal load shape.
    corr = float(np.corrcoef(df["temperature_c"], df["demand_mw"])[0, 1])
    hot = df[df["temperature_c"] > COMFORT_BAND_C[1]]
    slope = float(np.polyfit(hot["temperature_c"], hot["demand_mw"], 1)[0]) if len(hot) > 50 else None

    bins = (df["temperature_c"] / BIN_WIDTH_C).round() * BIN_WIDTH_C
    grouped = df.groupby(bins)["demand_mw"].agg(["mean", "count"])
    scatter = [
        {"temp_c": float(t), "avg_load_mw": round(float(r["mean"]), 1), "n_hours": int(r["count"])}
        for t, r in grouped.iterrows() if r["count"] >= MIN_HOURS_PER_BIN
    ]
    resp = {
        "correlation_temp_load": round(corr, 3),
        "sensitivity_mw_per_degc": round(slope, 1) if slope is not None else None,
        "comfort_band_c": [float(COMFORT_BAND_C[0]), float(COMFORT_BAND_C[1])],
        "data_source": store.history_source,
        "n_hours": int(len(df)),
        "period": {"start": hist["timestamp"].iloc[0].isoformat(), "end": hist["timestamp"].iloc[-1].isoformat()},
        "method": "Pearson correlation over all hours; sensitivity = OLS slope for hours above the comfort band",
        "scatter": scatter,
    }
    store.cache_set(key, resp)
    return resp
