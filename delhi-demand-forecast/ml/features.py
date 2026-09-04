"""Leakage-safe feature engineering.

Rules that keep the model honest:
* Every lag/rolling feature is built from values strictly *before* the target
  hour (``shift(1)`` before any rolling window).
* Weather features at time t are the weather *forecast/observation for t*,
  which is legitimately available ahead of time from a weather forecast.
* No feature is derived from demand at or after t.

``select_feature_columns`` picks only the features whose inputs exist in the
dataset, so a CSV without humidity or wind still trains.
"""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from ml.calendar import holidays_for_range
from ml.schema import TARGET, TIMESTAMP

COMFORT_TEMP_C = 24.0  # cooling load starts above this; heating below ~18

CALENDAR_FEATURES = [
    "hour", "hour_sin", "hour_cos", "day_of_week", "day_of_year", "month",
    "is_weekend", "is_holiday",
]
WEATHER_FEATURES = [
    "temperature_c", "temp_sq", "cooling_degree", "heating_degree", "humidity", "wind_speed",
]
LAG_FEATURES = ["lag_1h", "lag_24h", "lag_168h", "rolling_mean_24h", "rolling_mean_168h"]
OPTIONAL_INPUT_FEATURES = ["solar_generation_mw"]

# Human-readable labels for the explainability panel.
FEATURE_LABELS = {
    "hour": "Hour of day", "hour_sin": "Hour (sine)", "hour_cos": "Hour (cosine)",
    "day_of_week": "Day of week", "day_of_year": "Day of year", "month": "Month",
    "is_weekend": "Weekend", "is_holiday": "Public holiday",
    "temperature_c": "Temperature", "temp_sq": "Temperature squared",
    "cooling_degree": "Cooling degrees above 24C", "heating_degree": "Heating degrees below 18C",
    "humidity": "Humidity", "wind_speed": "Wind speed",
    "lag_1h": "Demand 1 h ago", "lag_24h": "Demand same hour yesterday",
    "lag_168h": "Demand same hour last week", "rolling_mean_24h": "Mean demand last 24 h",
    "rolling_mean_168h": "Mean demand last 7 d", "solar_generation_mw": "Rooftop solar generation",
}


def add_calendar_features(df: pd.DataFrame, holiday_dates: frozenset[date] | None = None) -> pd.DataFrame:
    ts = df[TIMESTAMP]
    out = df.copy()
    out["hour"] = ts.dt.hour
    out["hour_sin"] = np.sin(2 * np.pi * out["hour"] / 24)
    out["hour_cos"] = np.cos(2 * np.pi * out["hour"] / 24)
    out["day_of_week"] = ts.dt.dayofweek
    out["day_of_year"] = ts.dt.dayofyear
    out["month"] = ts.dt.month
    out["is_weekend"] = (out["day_of_week"] >= 5).astype(int)
    if holiday_dates is None:
        years = ts.dt.year
        holiday_dates = holidays_for_range(int(years.min()), int(years.max()))
    if "holiday" in out.columns and out["holiday"].notna().any():
        out["is_holiday"] = out["holiday"].fillna(0).astype(float).clip(0, 1).astype(int)
    else:
        out["is_holiday"] = ts.dt.date.map(lambda d: int(d in holiday_dates)).astype(int)
    return out


def add_weather_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "temperature_c" in out.columns:
        t = out["temperature_c"].astype(float)
        out["temp_sq"] = t ** 2
        out["cooling_degree"] = (t - COMFORT_TEMP_C).clip(lower=0)
        out["heating_degree"] = (18.0 - t).clip(lower=0)
    return out


def add_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    """Lags of the target. Requires an hourly-regular frame sorted by time."""
    out = df.copy()
    y = out[TARGET].astype(float)
    out["lag_1h"] = y.shift(1)
    out["lag_24h"] = y.shift(24)
    out["lag_168h"] = y.shift(168)
    prev = y.shift(1)
    out["rolling_mean_24h"] = prev.rolling(24, min_periods=12).mean()
    out["rolling_mean_168h"] = prev.rolling(168, min_periods=72).mean()
    return out


def build_features(df: pd.DataFrame, holiday_dates: frozenset[date] | None = None) -> pd.DataFrame:
    """Full feature frame for training (target column retained)."""
    out = add_calendar_features(df, holiday_dates)
    out = add_weather_features(out)
    out = add_lag_features(out)
    return out


def select_feature_columns(df: pd.DataFrame) -> list[str]:
    """Only features whose inputs are present and not entirely missing."""
    cols = []
    for c in CALENDAR_FEATURES + WEATHER_FEATURES + LAG_FEATURES + OPTIONAL_INPUT_FEATURES:
        if c in df.columns and df[c].notna().any():
            cols.append(c)
    return cols


def training_frame(df: pd.DataFrame, feature_cols: list[str]) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    """Drop rows with missing target or missing lag features (warm-up period)."""
    needed = feature_cols + [TARGET]
    clean = df.dropna(subset=[c for c in needed if c in LAG_FEATURES or c == TARGET])
    X = clean[feature_cols].astype(float)
    y = clean[TARGET].astype(float)
    return X, y, clean[TIMESTAMP]
