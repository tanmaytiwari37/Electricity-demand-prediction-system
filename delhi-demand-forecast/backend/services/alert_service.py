"""Capacity-risk assessment: forecast demand versus grid capacity.

Risk level per hour from utilisation = predicted / capacity:
    LOW < 85 % <= MEDIUM < 92 % <= HIGH < 97 % <= CRITICAL   (ASSUMPTION thresholds)
Consecutive hours at MEDIUM or above form one alert window. Recommended
actions are rule-based decision support, not operational instructions.
"""

from __future__ import annotations

import pandas as pd

from backend.config import DISCOM_SHARE, RISK_THRESHOLDS_PCT, settings
from backend.services.data_store import store
from backend.services.forecast_service import forecast_frame, peak_of
from backend.utils.time import iso, mw

LEVEL_ORDER = ["low", "medium", "high", "critical"]


def _share_order(top: int = 3) -> str:
    """DISCOMs by configured expected load share, e.g. 'BRPL ~40%, TPDDL ~33%, BYPL ~20%'.

    Our load data is system-wide only, so an action may rank DISCOMs by the share of
    load they are expected to carry but must never assert that a feeder is constrained.
    """
    ranked = sorted(DISCOM_SHARE.items(), key=lambda kv: kv[1], reverse=True)[:top]
    return ", ".join(f"{d} ~{s * 100:.0f}%" for d, s in ranked)


ACTIONS = {
    "critical": (
        "Peak within {gap:.0f}% of grid capacity",
        "Activate demand-response contracts, confirm spinning reserve and inter-state "
        "drawal schedule; brief all DISCOM control rooms, prioritising by expected load share "
        f"({_share_order()}). Feeder-level constraints cannot be identified from system-level data.",
    ),
    "high": (
        "Peak approaching grid capacity",
        "Pre-position spinning reserve; ask DISCOMs to verify transformer headroom in their own "
        f"networks, starting with the largest expected load shares ({_share_order()}); issue an "
        "advisory to large industrial consumers.",
    ),
    "medium": (
        "Elevated demand expected",
        "Monitor closely; schedule maintenance outside the window and keep reserve "
        "procurement options open.",
    ),
}
ADVISORY = "System-generated recommendation based on a demand forecast. Not an official grid instruction."


def risk_level(utilization_pct: float) -> str:
    if utilization_pct >= RISK_THRESHOLDS_PCT["critical"]:
        return "critical"
    if utilization_pct >= RISK_THRESHOLDS_PCT["high"]:
        return "high"
    if utilization_pct >= RISK_THRESHOLDS_PCT["medium"]:
        return "medium"
    return "low"


def assess(frame: pd.DataFrame, capacity: float, method: str) -> dict:
    util = frame["predicted_mw"] / capacity * 100
    levels = util.map(risk_level)
    peak = peak_of(frame)
    peak_util = float(util.max())

    alerts, window = [], []
    for ts, pred, lvl in zip(frame["timestamp"], frame["predicted_mw"], levels):
        if lvl != "low":
            window.append((ts, pred, lvl))
        elif window:
            alerts.append(window)
            window = []
    if window:
        alerts.append(window)

    out = []
    for n, win in enumerate(alerts, start=1):
        worst = max(win, key=lambda x: x[1])
        worst_level = max((w[2] for w in win), key=LEVEL_ORDER.index)
        headroom_mw = capacity - worst[1]
        gap = headroom_mw / capacity * 100
        title, action = ACTIONS[worst_level]
        out.append(
            {
                "id": f"alert-{n:03d}",
                "level": worst_level,
                "ts": iso(worst[0]),
                "window_start": iso(win[0][0]),
                "window_end": iso(win[-1][0]),
                "predicted_mw": mw(worst[1]),
                "capacity_mw": mw(capacity),
                "headroom_mw": mw(headroom_mw),
                "headroom_pct": round(gap, 1),
                "title": title.format(gap=gap),
                "message": (
                    f"Forecast demand reaches {worst[1]:.0f} MW at {pd.Timestamp(worst[0]).strftime('%H:%M')} IST "
                    f"({worst[1] / capacity * 100:.1f}% of {capacity:.0f} MW capacity). "
                    f"Window {pd.Timestamp(win[0][0]).strftime('%d %b %H:%M')} to "
                    f"{pd.Timestamp(win[-1][0]).strftime('%d %b %H:%M')} IST, {len(win)} hour(s)."
                ),
                "recommended_action": action,
                "advisory": ADVISORY,
            }
        )
    return {
        "risk_level": risk_level(peak_util),
        "peak_ts": peak["ts"],
        "peak_mw": peak["predicted_mw"],
        "peak_utilization_pct": round(peak_util, 1),
        "headroom_mw": mw(capacity - peak["predicted_mw"]),
        "headroom_pct": round(100 - peak_util, 1),
        "hours_at_risk": int((levels != "low").sum()),
        "thresholds_pct": RISK_THRESHOLDS_PCT,
        "forecast_method": method,
        "alerts": out,
    }


def build_alerts_response(horizon: int = 24, capacity_mw: float | None = None) -> dict:
    capacity = float(capacity_mw or settings.capacity_mw)
    frame, method = forecast_frame(horizon)
    result = assess(frame, capacity, method)
    return {
        "generated_at": iso(store.origin),
        "grid_capacity_mw": mw(capacity),
        "horizon_hours": horizon,
        "data_source": store.history_source,
        **result,
    }
