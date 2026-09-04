"""Weather data: Open-Meteo (REAL) with cache and graceful fallback.

Resolution order for the forecast used by the model:
  live Open-Meteo  ->  on-disk cache  ->  None (caller falls back to demo /
  historical-analog weather).  Open-Meteo needs no API key.  Every result is
  tagged with its source so the UI can show LIVE / CACHED / DEMO.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pandas as pd

from backend.config import DELHI_LAT, DELHI_LON, IST, settings

log = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
HOURLY_VARS = "temperature_2m,relative_humidity_2m,wind_speed_10m"
RENAME = {"temperature_2m": "temperature_c", "relative_humidity_2m": "humidity", "wind_speed_10m": "wind_speed"}


def _cache_path() -> Path:
    return settings.data_dir / "cache" / "weather_forecast.json"


def _to_frame(hourly: dict) -> pd.DataFrame:
    df = pd.DataFrame(hourly).rename(columns={"time": "timestamp", **RENAME})
    df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.tz_localize(IST)
    return df[["timestamp", "temperature_c", "humidity", "wind_speed"]]


def fetch_open_meteo_forecast(days: int = 8, timeout: float | None = None) -> pd.DataFrame:
    """Hourly forecast for Delhi in IST. Raises on network / HTTP errors."""
    params = {
        "latitude": DELHI_LAT, "longitude": DELHI_LON, "hourly": HOURLY_VARS,
        "timezone": "Asia/Kolkata", "forecast_days": days, "past_days": 1,
    }
    with httpx.Client(timeout=timeout or settings.weather_timeout_s) as client:
        r = client.get(FORECAST_URL, params=params)
        r.raise_for_status()
        return _to_frame(r.json()["hourly"])


def fetch_open_meteo_archive(start: str, end: str, timeout: float = 30.0) -> pd.DataFrame:
    """Historical hourly weather (YYYY-MM-DD bounds). Used by data-prep scripts
    when the user's demand CSV has no weather columns."""
    params = {
        "latitude": DELHI_LAT, "longitude": DELHI_LON, "hourly": HOURLY_VARS,
        "timezone": "Asia/Kolkata", "start_date": start, "end_date": end,
    }
    with httpx.Client(timeout=timeout) as client:
        r = client.get(ARCHIVE_URL, params=params)
        r.raise_for_status()
        return _to_frame(r.json()["hourly"])


def _write_cache(df: pd.DataFrame) -> None:
    path = _cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "rows": [{**r, "timestamp": r["timestamp"].isoformat()} for r in df.to_dict("records")],
    }
    path.write_text(json.dumps(payload))


def _read_cache() -> tuple[pd.DataFrame, str] | None:
    path = _cache_path()
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text())
        df = pd.DataFrame(payload["rows"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True).dt.tz_convert(IST)
        return df, payload["fetched_at"]
    except Exception as exc:  # corrupt cache is not fatal
        log.warning("weather cache unreadable: %s", exc)
        return None


class WeatherResult:
    def __init__(self, frame: pd.DataFrame | None, source: str, fetched_at: str | None = None, error: str | None = None):
        self.frame = frame
        self.source = source  # "live" | "cache" | "unavailable"
        self.fetched_at = fetched_at
        self.error = error


def get_weather_forecast() -> WeatherResult:
    """Live if possible, else cache, else unavailable. Never raises."""
    if not settings.weather_enabled:
        return WeatherResult(None, "unavailable", error="weather disabled by settings")
    cached = _read_cache()
    if cached is not None:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(cached[1])
        if age < timedelta(minutes=settings.weather_cache_ttl_min):
            return WeatherResult(cached[0], "cache", cached[1])
    try:
        df = fetch_open_meteo_forecast()
        _write_cache(df)
        return WeatherResult(df, "live", datetime.now(timezone.utc).isoformat())
    except Exception as exc:
        log.warning("Open-Meteo fetch failed (%s); falling back", exc)
        if cached is not None:
            return WeatherResult(cached[0], "cache", cached[1], error=str(exc))
        return WeatherResult(None, "unavailable", error=str(exc))
