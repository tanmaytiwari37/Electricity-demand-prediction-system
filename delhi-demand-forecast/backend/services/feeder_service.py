"""Area / DISCOM view: the system forecast split by DISCOM share (SIMULATED).

Real feeder telemetry is not public, so each DISCOM's load is its configured
share of system demand and its capacity is that share of grid capacity times
a simulated headroom factor. Status thresholds come from config.
"""

from __future__ import annotations

import pandas as pd

from backend.config import DISCOM_SHARE, FEEDER_CAPACITY_FACTOR, FEEDERS, UTIL_CRITICAL_PCT, UTIL_WARNING_PCT, settings
from backend.services.data_store import store
from backend.services.forecast_service import forecast_frame, peak_of
from backend.utils.time import iso, mw, parse_ts


def status_for(util_pct: float) -> str:
    if util_pct >= UTIL_CRITICAL_PCT:
        return "critical"
    if util_pct >= UTIL_WARNING_PCT:
        return "warning"
    return "ok"


def _feeder_rows(system_mw: float, capacity: float) -> list[dict]:
    rows = []
    for fid, name, discom, lat, lon in FEEDERS:
        share = DISCOM_SHARE[discom]
        predicted = system_mw * share
        cap = capacity * share * FEEDER_CAPACITY_FACTOR[discom]
        util = round(predicted / cap * 100, 1)
        rows.append(
            {
                "id": fid, "name": name, "discom": discom,
                "predicted_mw": mw(predicted), "capacity_mw": mw(cap),
                "utilization_pct": util, "status": status_for(util),
                "share_pct": round(share * 100, 1), "lat": lat, "lon": lon,
            }
        )
    return rows


def build_feeders_response(ts: str | None, horizon: int = 24, capacity_mw: float | None = None) -> dict:
    capacity = float(capacity_mw or settings.capacity_mw)
    frame, method = forecast_frame(horizon)
    peak = peak_of(frame)

    if ts:
        target = parse_ts(ts)
        hist = store.history.set_index("timestamp")["demand_mw"]
        fut = frame.set_index("timestamp")["predicted_mw"]
        if target in fut.index:
            system_mw, basis = float(fut[target]), "forecast"
        elif target in hist.index and pd.notna(hist[target]):
            system_mw, basis = float(hist[target]), "actual"
        else:
            system_mw, basis, target = peak["predicted_mw"], "forecast_peak", pd.Timestamp(peak["ts"])
    else:
        system_mw, basis, target = peak["predicted_mw"], "forecast_peak", pd.Timestamp(peak["ts"])

    hourly = [
        {
            "ts": iso(r.timestamp),
            "system_mw": mw(r.predicted_mw),
            "utilization_pct": {
                row["id"]: row["utilization_pct"] for row in _feeder_rows(float(r.predicted_mw), capacity)
            },
        }
        for r in frame.itertuples()
    ]
    return {
        "as_of": iso(target),
        "basis": basis,
        "data_source": store.history_source,
        "allocation": "simulated_discom_share",
        "forecast_method": method,
        "system_mw": mw(system_mw),
        "feeders": _feeder_rows(system_mw, capacity),
        "hourly": hourly,
    }
