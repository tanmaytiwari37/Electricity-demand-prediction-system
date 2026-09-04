"""SIMULATED demo dataset generator.

Everything produced here is synthetic. It is conditioned on a synthetic
Delhi-like weather model and calibrated only to widely reported public
ranges (summer peaks roughly 7,500-8,300 MW, winter troughs near 3,000 MW).
It exists so the whole product works before the real CSV arrives and so
DEMO MODE has something coherent to show. Never present it as real data.

The generator is deterministic for a given (start, end, seed).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from ml.calendar import holidays_for_range
from ml.schema import TIMESTAMP

IST = ZoneInfo("Asia/Kolkata")

# Monthly mean temperature (degC) and diurnal half-range for Delhi-like climate.
MONTHLY_MEAN_TEMP = [14.0, 17.5, 23.0, 30.0, 34.0, 34.5, 31.5, 30.5, 30.0, 26.5, 20.5, 15.5]
MONTHLY_DIURNAL_AMP = [5.5, 6.0, 6.5, 7.0, 7.0, 6.0, 4.0, 3.8, 4.5, 6.0, 6.0, 5.5]
MONTHLY_HUMIDITY = [70, 60, 48, 32, 30, 45, 75, 80, 72, 55, 62, 70]

# Normalised hour-of-day shape (mean ~1.0) for a Delhi-like load curve.
HOUR_SHAPE = np.array([
    0.90, 0.86, 0.83, 0.81, 0.80, 0.82, 0.86, 0.92, 0.98, 1.03, 1.07, 1.09,
    1.11, 1.13, 1.15, 1.16, 1.15, 1.11, 1.07, 1.07, 1.09, 1.05, 0.99, 0.94,
])

BASE_LOAD_MW = 3550.0          # weather-neutral average
COOLING_MW_PER_DEG = 255.0     # per degC of effective temp above comfort (humid days amplified)
HEATING_MW_PER_DEG = 90.0      # per degC of effective temp below 18
THERMAL_INERTIA = 0.5          # weight of 24 h mean temperature in the effective temperature
WEEKEND_FACTOR = 0.94
HOLIDAY_FACTOR = 0.90
ANNUAL_GROWTH = 0.03
ROOFTOP_SOLAR_CAPACITY_MW = 250.0
SOLAR_SHAPE = np.array([0, 0, 0, 0, 0, 0, 0.05, 0.22, 0.45, 0.65, 0.80, 0.88,
                        0.90, 0.88, 0.78, 0.62, 0.42, 0.20, 0.04, 0, 0, 0, 0, 0])


def _interp_monthly(values: list[float], doy: np.ndarray) -> np.ndarray:
    """Smooth monthly table across the year using day-of-year interpolation."""
    centres = np.array([15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349])
    vals = np.array(values)
    x = np.concatenate([centres - 365, centres, centres + 365])
    y = np.concatenate([vals, vals, vals])
    return np.interp(doy, x, y)


def generate_demo_weather(start: datetime, hours: int, seed: int = 7) -> pd.DataFrame:
    """Synthetic hourly weather starting at ``start`` (IST)."""
    ts = pd.date_range(start, periods=hours, freq="h", tz=IST)
    # Seed on the absolute hour so overlapping windows produce identical values.
    epoch_hour = int(pd.Timestamp(start).tz_convert("UTC").timestamp() // 3600)
    rng = np.random.default_rng(seed + epoch_hour % 100_000)

    doy = ts.dayofyear.to_numpy()
    hour = ts.hour.to_numpy()
    mean_t = _interp_monthly(MONTHLY_MEAN_TEMP, doy)
    amp = _interp_monthly(MONTHLY_DIURNAL_AMP, doy)
    diurnal = -np.cos(2 * np.pi * (hour - 4) / 24)  # trough ~04:00, peak ~16:00
    temp = mean_t + amp * diurnal

    # Slow-moving weather noise (heat waves / western disturbances) as AR(1).
    ar = np.zeros(hours)
    eps = rng.normal(0, 0.35, hours)
    for i in range(1, hours):
        ar[i] = 0.97 * ar[i - 1] + eps[i]
    temp = temp + ar

    hum = _interp_monthly(MONTHLY_HUMIDITY, doy) - 0.9 * amp * diurnal - 1.5 * ar + rng.normal(0, 3, hours)
    hum = np.clip(hum, 12, 98)
    wind = np.clip(8 + 4 * diurnal + rng.normal(0, 2.5, hours), 0, 40)
    cloud = np.clip(0.15 + 0.5 * (hum > 70) + rng.normal(0, 0.1, hours), 0, 0.9)
    solar = ROOFTOP_SOLAR_CAPACITY_MW * SOLAR_SHAPE[hour] * (1 - cloud)

    return pd.DataFrame(
        {
            TIMESTAMP: ts,
            "temperature_c": np.round(temp, 1),
            "humidity": np.round(hum, 0),
            "wind_speed": np.round(wind, 1),
            "solar_generation_mw": np.round(solar, 1),
        }
    )


def demand_from_weather(weather: pd.DataFrame, seed: int = 11) -> np.ndarray:
    """Synthetic system demand (MW) conditioned on a weather frame."""
    ts = pd.DatetimeIndex(weather[TIMESTAMP])
    hour = ts.hour.to_numpy()
    temp = weather["temperature_c"].to_numpy(dtype=float)
    hum = weather["humidity"].to_numpy(dtype=float)
    years = ts.year
    hol = holidays_for_range(int(years.min()), int(years.max()))

    # Buildings hold heat: AC load follows a blend of the current and the 24 h mean temperature.
    daily_mean = pd.Series(temp).rolling(24, min_periods=1).mean().to_numpy()
    eff_temp = (1 - THERMAL_INERTIA) * temp + THERMAL_INERTIA * daily_mean
    cooling = np.clip(eff_temp - 24.0, 0, None) * COOLING_MW_PER_DEG * (1 + 0.004 * np.clip(hum - 40, 0, None))
    heating = np.clip(18.0 - eff_temp, 0, None) * HEATING_MW_PER_DEG
    weather_load = (BASE_LOAD_MW + cooling + heating) * HOUR_SHAPE[hour]

    day_factor = np.where(ts.dayofweek >= 5, WEEKEND_FACTOR, 1.0)
    is_hol = np.array([d in hol for d in ts.date])
    day_factor = np.where(is_hol, HOLIDAY_FACTOR, day_factor)

    t0 = ts[0]
    years_elapsed = ((ts - t0).total_seconds() / (365.25 * 86400)).to_numpy()
    growth = (1 + ANNUAL_GROWTH) ** years_elapsed

    epoch_hour = int(ts[0].tz_convert("UTC").timestamp() // 3600)
    rng = np.random.default_rng(seed + epoch_hour % 100_000)
    noise = np.zeros(len(ts))
    eps = rng.normal(0, 60, len(ts))
    for i in range(1, len(ts)):
        noise[i] = 0.8 * noise[i - 1] + eps[i]

    demand = weather_load * day_factor * growth + noise
    solar = weather["solar_generation_mw"].to_numpy(dtype=float) if "solar_generation_mw" in weather else 0
    return np.round(demand - 0.5 * solar, 1)  # behind-the-meter solar shaves a little grid demand


HISTORY_COLUMNS = [TIMESTAMP, "demand_mw", "temperature_c", "humidity", "wind_speed", "solar_generation_mw"]


def generate_demo_history(
    end: datetime, days: int = 730, seed: int = 7, future_hours: int = 0
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Synthetic hourly history ending at ``end`` (inclusive), ``days`` long.

    Returns ``(history, future_weather)``. The future weather is generated in
    the same pass so it continues the history's weather noise seamlessly
    instead of restarting it at the forecast origin.
    """
    end = pd.Timestamp(end).tz_convert(IST) if pd.Timestamp(end).tzinfo else pd.Timestamp(end, tz=IST)
    end = end.floor("h")
    hours = days * 24
    start = end - timedelta(hours=hours - 1)
    weather = generate_demo_weather(start.to_pydatetime(), hours + future_hours, seed)
    weather["demand_mw"] = demand_from_weather(weather, seed + 4)
    history = weather.iloc[:hours][HISTORY_COLUMNS].reset_index(drop=True)
    future = weather.iloc[hours:].drop(columns=["demand_mw"]).reset_index(drop=True)
    return history, future
