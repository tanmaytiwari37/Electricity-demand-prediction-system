"""Canonical column names for the historical demand + weather dataset.

The pipeline accepts a CSV with at least ``timestamp`` and ``demand_mw``.
Weather and calendar columns are optional; when present they are used as
features, when absent the pipeline degrades gracefully. Common alternative
spellings are mapped through ``COLUMN_ALIASES`` so the user's CSV does not
have to be renamed by hand.
"""

from __future__ import annotations

TIMESTAMP = "timestamp"
TARGET = "demand_mw"

REQUIRED_COLUMNS: tuple[str, ...] = (TIMESTAMP, TARGET)

# Optional columns the pipeline knows how to use.
OPTIONAL_COLUMNS: tuple[str, ...] = (
    "temperature_c",
    "humidity",
    "wind_speed",
    "solar_generation_mw",
    "holiday",
)

WEATHER_COLUMNS: tuple[str, ...] = ("temperature_c", "humidity", "wind_speed")

# lower-case alias -> canonical name
COLUMN_ALIASES: dict[str, str] = {
    "ts": TIMESTAMP,
    "datetime": TIMESTAMP,
    "date_time": TIMESTAMP,
    "time": TIMESTAMP,
    "date": TIMESTAMP,
    "load_mw": TARGET,
    "demand": TARGET,
    "load": TARGET,
    "actual_mw": TARGET,
    "temp_c": "temperature_c",
    "temperature": "temperature_c",
    "temp": "temperature_c",
    "temperature_2m": "temperature_c",
    "rh": "humidity",
    "relative_humidity": "humidity",
    "relative_humidity_2m": "humidity",
    "humidity_pct": "humidity",
    "wind": "wind_speed",
    "wind_speed_kmh": "wind_speed",
    "wind_speed_10m": "wind_speed",
    "solar_mw": "solar_generation_mw",
    "solar_generation": "solar_generation_mw",
    "is_holiday": "holiday",
}


class SchemaError(ValueError):
    """Raised when a dataset cannot be used by the pipeline."""
