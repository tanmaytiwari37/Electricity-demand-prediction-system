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


# --------------------------------------------------------------------------- #
# Recursive multi-hour band, calibrated per lead hour
# --------------------------------------------------------------------------- #
LEAD_BUCKETS = ((1, 6), (7, 12), (13, 18), (19, 24))


def recursive_residuals_by_lead(predictor, history: pd.DataFrame, horizon: int = 24,
                                origin_step_hours: int = 6, start=None) -> pd.DataFrame:
    """Out-of-sample recursive residuals (actual - predicted) for every lead 1..horizon.

    Origins step through ``history`` every ``origin_step_hours`` from ``start``.
    Each forecast uses the *actual* weather that follows the origin, so the
    residuals isolate model + recursion error from weather-forecast error.
    Returns a frame with columns ``origin``, ``lead``, ``resid``.
    """
    from ml.schema import TARGET, TIMESTAMP, WEATHER_COLUMNS

    hist = history.sort_values(TIMESTAMP).reset_index(drop=True)
    weather_cols = [c for c in list(WEATHER_COLUMNS) + ["solar_generation_mw"] if c in hist.columns]
    y = hist[TARGET].to_numpy(dtype=float)
    ts = hist[TIMESTAMP]
    first = 0 if start is None else int((ts < pd.Timestamp(start)).sum())
    first = max(first, 24 * 8)  # a week of lags plus margin
    rows = []
    for i in range(first, len(hist) - horizon, origin_step_hours):
        actual = y[i + 1: i + 1 + horizon]
        if np.isnan(actual).any() or np.isnan(y[i]):
            continue
        past = hist.iloc[max(0, i - 24 * 21): i + 1]
        if past[TARGET].notna().sum() < 168:
            continue
        future = hist.iloc[i + 1: i + 1 + horizon][[TIMESTAMP] + weather_cols]
        try:
            out = predictor.predict_horizon(past, future, horizon)
        except ValueError:
            continue
        resid = actual - out["predicted_mw"].to_numpy()
        origin = ts.iloc[i]
        rows.extend({"origin": origin, "lead": h + 1, "resid": float(resid[h])} for h in range(horizon))
    return pd.DataFrame(rows, columns=["origin", "lead", "resid"])


def lead_band(resid: pd.DataFrame, window_days: int, horizon: int) -> dict | None:
    """Served band: per-lead P10/P90 of residuals whose origin lies in the most recent window."""
    if resid.empty:
        return None
    recent = resid[resid["origin"] > resid["origin"].max() - pd.Timedelta(days=window_days)]
    p10, p90 = [], []
    for h in range(1, horizon + 1):
        r = recent.loc[recent["lead"] == h, "resid"].to_numpy()
        if len(r) < 10:
            return None
        p10.append(float(np.quantile(r, LO)))
        p90.append(float(np.quantile(r, HI)))
    return {
        "p10": p10, "p90": p90, "window_days": window_days,
        "n_origins": int(recent["origin"].nunique()),
        "calibrated_on": {"start": recent["origin"].min().isoformat(), "end": recent["origin"].max().isoformat()},
    }


def rolling_lead_coverage(resid: pd.DataFrame, window_days: int, min_origins: int = 28) -> dict | None:
    """Coverage when each lead's band is the P10/P90 of that lead's residuals from the
    preceding ``window_days`` of origins (the served rule, scored out-of-sample)."""
    if resid.empty:
        return None
    by_lead, scored = {}, 0
    for h, g in resid.groupby("lead"):
        s = g.set_index("origin")["resid"].sort_index()
        roll = s.rolling(f"{window_days}D", min_periods=min_origins, closed="left")
        lo, hi = roll.quantile(LO), roll.quantile(HI)
        ok = lo.notna() & hi.notna()
        if not ok.any():
            continue
        by_lead[int(h)] = float(((s[ok] >= lo[ok]) & (s[ok] <= hi[ok])).mean() * 100)
        scored += int(ok.sum())
    if not by_lead:
        return None
    leads = sorted(by_lead)
    buckets = {}
    for a, b in LEAD_BUCKETS:
        vals = [by_lead[h] for h in leads if a <= h <= b]
        if vals:
            buckets[f"{a}-{b}"] = round(float(np.mean(vals)), 1)
    return {
        "overall_pct": round(float(np.mean([by_lead[h] for h in leads])), 1),
        "by_bucket_pct": buckets,
        "by_lead_pct": [round(by_lead[h], 1) for h in leads],
        "n_scored": scored,
        "window_days": window_days,
    }
