"""System status and model card for the UI's provenance badges."""

from __future__ import annotations

from backend.config import APP_VERSION, DISCOM_SHARE, RISK_THRESHOLDS_PCT, settings
from backend.services.data_store import store
from backend.utils.time import iso, now_ist

PROVENANCE = {
    "history": {"real": "REAL HISTORICAL", "demo": "SIMULATED DEMO"},
    "weather": {"live": "LIVE WEATHER", "cache": "CACHED WEATHER", "demo": "SIMULATED WEATHER",
                "historical_analog": "HISTORICAL ANALOG WEATHER"},
    "forecast": {"ml_model": "MODEL PREDICTION", "heuristic": "HEURISTIC ESTIMATE"},
}


def model_card() -> dict:
    p = store.predictor
    if p is None:
        return {"status": store.model_status, "error": store.model_error, "loaded": False}
    m = p.metrics
    return {
        "status": store.model_status,
        "loaded": True,
        "name": p.model_name,
        "data_source": p.data_source,
        "trained_at": p.metadata.get("trained_at"),
        "training_seconds": p.metadata.get("training_seconds"),
        "history_start": p.metadata.get("history_start"),
        "history_end": p.metadata.get("history_end"),
        "n_rows": p.metadata.get("n_rows"),
        "feature_columns": p.feature_columns,
        "baseline_name": m.get("primary_baseline"),
        "baseline_mae": m.get("baseline_mae"),
        "model_mae": m.get("model_mae"),
        "improvement_pct": m.get("improvement_pct"),
        "interval_coverage_pct": m.get("interval_coverage_pct"),
        "test_period": m.get("test_period"),
        "rows": m.get("rows"),
        "baselines": m.get("baselines"),
        "candidates": m.get("candidates"),
        "feature_importance": p.feature_importance,
        "residual_quantiles": p.residual_quantiles,
        "dataset_report": p.metadata.get("dataset_report"),
    }


def build_status_response() -> dict:
    method = "ml_model" if store.predictor is not None else "heuristic"
    return {
        "version": APP_VERSION,
        "now": iso(now_ist()),
        "as_of": iso(store.origin),
        "loaded_at": store.loaded_at,
        "demo_mode": store.is_demo,
        "data_source": store.history_source,
        "history": {
            "source": store.history_source,
            "label": PROVENANCE["history"][store.history_source],
            "start": iso(store.history["timestamp"].iloc[0]),
            "end": iso(store.origin),
            "rows": int(store.history["demand_mw"].notna().sum()),
            "report": store.dataset_report.to_dict() if store.dataset_report else None,
        },
        "weather": {
            "source": store.weather_source,
            "label": PROVENANCE["weather"].get(store.weather_source, store.weather_source.upper()),
            "fetched_at": store.weather_fetched_at,
            "error": store.weather_error,
        },
        "forecast": {"method": method, "label": PROVENANCE["forecast"][method]},
        "model": model_card(),
        "assumptions": {
            "grid_capacity_mw": float(settings.capacity_mw),
            "capacity_basis": "planning_assumption",
            "risk_thresholds_pct": RISK_THRESHOLDS_PCT,
            "discom_share": DISCOM_SHARE,
        },
    }
