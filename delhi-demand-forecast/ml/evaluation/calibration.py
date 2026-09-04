"""Prediction-interval calibration from empirical residuals.

The band around a point forecast is the P10/P90 of the model's *out-of-sample*
residuals. Two schemes are compared:

* ``static``  - quantiles of the original validation split applied to every
  later hour. Simple, but error size drifts with season, so coverage decays.
* ``rolling`` - for hour t, quantiles of the residuals over the preceding
  ``window_hours``. The served band uses the quantiles of the most recent
  window, and coverage is measured the same way on the held-out test period
  (each hour scored only against residuals that precede it), so the reported
  figure is what a served system would achieve, never an in-sample number.

Residual arrays are hourly and chronological; small holes left by dropped
warm-up rows make the window a count of scored hours rather than clock hours.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

LO, HI = 0.10, 0.90
MIN_HOURS = 168  # one week of residuals before the rolling band is trusted


def quantile_band(resid) -> dict[str, float]:
    """P10 / P50 / P90 / std of a residual array (NaNs ignored)."""
    r = np.asarray(resid, dtype=float)
    r = r[~np.isnan(r)]
    if len(r) == 0:
        return {"p10": 0.0, "p50": 0.0, "p90": 0.0, "std": 0.0}
    return {
        "p10": float(np.quantile(r, LO)),
        "p50": float(np.quantile(r, 0.50)),
        "p90": float(np.quantile(r, HI)),
        "std": float(np.std(r)),
    }


def static_coverage(resid, band: dict[str, float]) -> float:
    """Share of residuals inside a fixed [p10, p90] band, in percent."""
    r = np.asarray(resid, dtype=float)
    r = r[~np.isnan(r)]
    if len(r) == 0:
        return float("nan")
    return float(np.mean((r >= band["p10"]) & (r <= band["p90"])) * 100)


def rolling_coverage(resid, window_hours: int, min_hours: int = MIN_HOURS) -> dict[str, float | int]:
    """Coverage when hour t's band is the P10/P90 of the preceding ``window_hours`` residuals."""
    s = pd.Series(np.asarray(resid, dtype=float))
    roll = s.rolling(window_hours, min_periods=min_hours)
    lo = roll.quantile(LO).shift(1)
    hi = roll.quantile(HI).shift(1)
    ok = lo.notna() & hi.notna() & s.notna()
    if not ok.any():
        return {"coverage_pct": float("nan"), "n_scored": 0, "window_hours": window_hours}
    covered = (s[ok] >= lo[ok]) & (s[ok] <= hi[ok])
    return {"coverage_pct": round(float(covered.mean() * 100), 1), "n_scored": int(ok.sum()), "window_hours": window_hours}


def recent_window_band(resid, window_hours: int) -> dict[str, float]:
    """Band from the most recent ``window_hours`` residuals - what the served forecast uses."""
    r = np.asarray(resid, dtype=float)
    return quantile_band(r[-window_hours:])
