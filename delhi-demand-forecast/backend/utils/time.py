"""Time helpers: everything the API emits is IST, ISO 8601, hour-aligned."""

from __future__ import annotations

from datetime import datetime

import pandas as pd

from backend.config import IST, settings


def now_ist() -> datetime:
    """Current wall-clock hour in IST, or the frozen clock from settings."""
    if settings.fixed_now:
        dt = datetime.fromisoformat(settings.fixed_now)
        dt = dt.replace(tzinfo=IST) if dt.tzinfo is None else dt.astimezone(IST)
    else:
        dt = datetime.now(IST)
    return dt.replace(minute=0, second=0, microsecond=0)


def to_ist(ts) -> pd.Timestamp:
    t = pd.Timestamp(ts)
    return t.tz_localize(IST) if t.tzinfo is None else t.tz_convert(IST)


def iso(ts) -> str:
    return to_ist(ts).isoformat()


def parse_ts(value: str) -> pd.Timestamp:
    return to_ist(pd.Timestamp(value)).floor("h")


def mw(value: float) -> float:
    """Power values are floats with one decimal everywhere in the API."""
    return round(float(value), 1)
