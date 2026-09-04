"""What-if scenarios: temperature shift and rooftop-solar build-out.

* Temperature: the forecast is re-run with the shifted weather frame, so with
  a trained model the response is the model's own sensitivity, not a fixed
  coefficient. The heuristic fallback uses the configured MW/degC.
* Rooftop solar: installed capacity x an hour-of-day generation profile
  (ASSUMPTION), subtracted from grid demand. Cloud cover is not modelled.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from backend.config import DEMO_SOLAR_FACTOR, settings
from backend.services.data_store import store
from backend.services.forecast_service import forecast_frame
from backend.utils.time import iso, mw


def build_whatif_response(temp_delta_c: float, rooftop_solar_mw: float, horizon: int, capacity_mw: float | None = None) -> dict:
    capacity = float(capacity_mw or settings.capacity_mw)
    base, method = forecast_frame(horizon)
    scen, _ = forecast_frame(horizon, temp_delta_c=temp_delta_c) if temp_delta_c else (base, method)

    hours = base["timestamp"].dt.hour.to_numpy()
    solar = rooftop_solar_mw * np.array(DEMO_SOLAR_FACTOR)[hours]
    scenario_mw = scen["predicted_mw"].to_numpy() - solar

    points = [
        {
            "ts": iso(t),
            "baseline_mw": mw(b),
            "scenario_mw": mw(s),
            "solar_gen_mw": mw(g),
            "temp_effect_mw": mw(w - b),
        }
        for t, b, s, g, w in zip(base["timestamp"], base["predicted_mw"], scenario_mw, solar, scen["predicted_mw"])
    ]
    i_base = int(np.argmax(base["predicted_mw"].to_numpy()))
    i_scen = int(np.argmax(scenario_mw))
    baseline_peak = float(base["predicted_mw"].iloc[i_base])
    scenario_peak = float(scenario_mw[i_scen])
    return {
        "baseline_peak_mw": mw(baseline_peak),
        "scenario_peak_mw": mw(scenario_peak),
        "net_delta_mw": mw(scenario_peak - baseline_peak),
        "capacity_breach": scenario_peak > capacity,
        "grid_capacity_mw": mw(capacity),
        "baseline_peak_ts": iso(base["timestamp"].iloc[i_base]),
        "scenario_peak_ts": iso(base["timestamp"].iloc[i_scen]),
        "temp_effect_at_peak_mw": mw(float(scen["predicted_mw"].iloc[i_scen]) - float(base["predicted_mw"].iloc[i_scen])),
        "solar_at_peak_mw": mw(float(solar[i_scen])),
        "solar_peak_gen_mw": mw(float(solar.max())),
        "energy_delta_mwh": mw(float(np.sum(scenario_mw - base["predicted_mw"].to_numpy()))),
        "inputs": {"temp_delta_c": temp_delta_c, "rooftop_solar_mw": rooftop_solar_mw, "horizon": horizon},
        "forecast_method": method,
        "data_source": store.history_source,
        "points": points,
    }
