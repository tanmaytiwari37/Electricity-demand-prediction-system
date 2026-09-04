"""Public-holiday calendar for Delhi (REAL data via the ``holidays`` package)."""

from __future__ import annotations

from datetime import date
from functools import lru_cache

try:
    import holidays as _holidays
except ImportError:  # pragma: no cover - dependency is in requirements
    _holidays = None


@lru_cache(maxsize=16)
def delhi_holidays(years: tuple[int, ...]) -> frozenset[date]:
    """Return the set of public-holiday dates for the given years.

    Uses the Delhi subdivision when the installed ``holidays`` version knows
    it, otherwise national Indian holidays. Returns an empty set if the
    package is unavailable so the pipeline still runs (is_holiday = 0).
    """
    if _holidays is None or not years:
        return frozenset()
    try:
        cal = _holidays.country_holidays("IN", subdiv="DL", years=list(years))
    except Exception:
        cal = _holidays.country_holidays("IN", years=list(years))
    return frozenset(cal.keys())


def holidays_for_range(start_year: int, end_year: int) -> frozenset[date]:
    return delhi_holidays(tuple(range(start_year, end_year + 1)))
