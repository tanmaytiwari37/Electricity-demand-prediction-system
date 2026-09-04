"""Contract tests for every endpoint (heuristic mode and model mode)."""

import re

import pytest

from backend.config import settings

ISO_IST = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$")


def _assert_mw(value):
    assert isinstance(value, float)
    assert round(value, 1) == value


def _walk(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            _walk(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _walk(v, f"{path}[{i}]")
    else:
        if path.endswith((".ts", ".generated_at", ".as_of", ".window_start", ".window_end", "_ts")):
            assert ISO_IST.match(obj), (path, obj)
        if path.endswith("_mw") and obj is not None:
            _assert_mw(obj)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["data_source"] == "demo"
    assert "version" in body and "model_loaded" in body


def test_status_reports_demo_mode(client):
    body = client.get("/api/status").json()
    assert body["demo_mode"] is True
    assert body["history"]["label"] == "SIMULATED DEMO"
    assert body["weather"]["source"] == "demo"
    assert body["assumptions"]["grid_capacity_mw"] == settings.capacity_mw
    assert body["assumptions"]["capacity_basis"] == "planning_assumption"


def test_cors_preflight(client):
    r = client.options(
        "/api/forecast",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"


@pytest.mark.parametrize("horizon", [24, 168])
def test_forecast_contract(client, horizon):
    body = client.get(f"/api/forecast?horizon={horizon}").json()
    assert body["horizon_hours"] == horizon
    assert body["data_source"] == "demo"
    assert body["grid_capacity_mw"] == settings.capacity_mw
    assert body["generated_at"] == "2026-09-04T10:00:00+05:30"
    assert len(body["points"]) == horizon
    p = body["points"][0]
    assert p["ts"] == "2026-09-04T11:00:00+05:30"
    assert set(p) >= {"ts", "predicted_mw", "lower_mw", "upper_mw", "temp_c", "humidity"}
    assert p["lower_mw"] <= p["predicted_mw"] <= p["upper_mw"]
    assert body["peak"]["predicted_mw"] == max(q["predicted_mw"] for q in body["points"])
    _walk(body)


def test_forecast_rejects_bad_horizon(client):
    assert client.get("/api/forecast?horizon=0").status_code == 422
    assert client.get("/api/forecast?horizon=999").status_code == 422


def test_actual_contract(client):
    body = client.get("/api/actual?hours=48").json()
    assert body["data_source"] == "demo"
    assert len(body["points"]) == 48
    assert body["points"][-1]["ts"] == "2026-09-04T10:00:00+05:30"
    assert body["points"][0]["ts"] < body["points"][-1]["ts"]
    assert all(p["actual_mw"] > 0 for p in body["points"])
    _walk(body)


def test_alerts_contract_and_risk_levels(client):
    body = client.get("/api/alerts").json()
    assert body["grid_capacity_mw"] == settings.capacity_mw
    assert body["risk_level"] in {"low", "medium", "high", "critical"}
    assert isinstance(body["alerts"], list)
    assert body["headroom_mw"] == round(settings.capacity_mw - body["peak_mw"], 1)
    _walk(body)


def test_alerts_appear_when_capacity_is_low(client):
    body = client.get("/api/alerts?capacity_mw=4000").json()
    assert body["risk_level"] == "critical"
    assert body["alerts"], "expected at least one alert window"
    a = body["alerts"][0]
    assert set(a) >= {"id", "level", "ts", "predicted_mw", "capacity_mw", "headroom_pct",
                      "title", "message", "recommended_action", "advisory"}
    assert a["capacity_mw"] == 4000.0
    assert "not an official" in a["advisory"].lower()


def test_feeders_contract(client):
    body = client.get("/api/feeders").json()
    assert body["data_source"] == "demo"
    assert body["allocation"] == "simulated_discom_share"
    ids = {f["discom"] for f in body["feeders"]}
    assert ids == {"BRPL", "BYPL", "TPDDL", "NDMC", "MES"}
    for f in body["feeders"]:
        assert set(f) >= {"id", "name", "discom", "predicted_mw", "capacity_mw", "utilization_pct", "status", "lat", "lon"}
        assert f["status"] in {"ok", "warning", "critical"}
        assert abs(f["utilization_pct"] - round(f["predicted_mw"] / f["capacity_mw"] * 100, 1)) < 0.15
    assert abs(sum(f["predicted_mw"] for f in body["feeders"]) - body["system_mw"]) < 1.0
    assert len(body["hourly"]) == 24
    _walk(body)


def test_feeders_with_timestamp(client):
    body = client.get("/api/feeders?ts=2026-09-04T15:00:00%2B05:30").json()
    assert body["as_of"] == "2026-09-04T15:00:00+05:30"
    assert body["basis"] == "forecast"
    assert client.get("/api/feeders?ts=not-a-date").status_code == 422


def test_weather_impact_contract(client):
    body = client.get("/api/weather-impact").json()
    assert body["data_source"] == "demo"
    assert body["comfort_band_c"] == [22.0, 26.0]
    assert 0.5 < body["correlation_temp_load"] <= 1.0
    assert body["sensitivity_mw_per_degc"] > 0
    assert body["scatter"] and set(body["scatter"][0]) == {"temp_c", "avg_load_mw", "n_hours"}
    temps = [s["temp_c"] for s in body["scatter"]]
    assert temps == sorted(temps)


def test_whatif_contract(client):
    r = client.post("/api/whatif", json={"temp_delta_c": 2, "rooftop_solar_mw": 500, "horizon": 24})
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {"baseline_peak_mw", "scenario_peak_mw", "net_delta_mw", "capacity_breach", "points", "data_source"}
    assert len(body["points"]) == 24
    assert set(body["points"][0]) >= {"ts", "baseline_mw", "scenario_mw", "solar_gen_mw"}
    assert body["net_delta_mw"] == round(body["scenario_peak_mw"] - body["baseline_peak_mw"], 1)
    assert body["solar_peak_gen_mw"] == 450.0  # 500 MW x 0.90 noon factor
    _walk(body)


def test_whatif_hotter_raises_peak_and_solar_lowers_it(client):
    hot = client.post("/api/whatif", json={"temp_delta_c": 3, "rooftop_solar_mw": 0, "horizon": 24}).json()
    assert hot["scenario_peak_mw"] > hot["baseline_peak_mw"]
    solar = client.post("/api/whatif", json={"temp_delta_c": 0, "rooftop_solar_mw": 1000, "horizon": 24}).json()
    assert solar["scenario_peak_mw"] <= solar["baseline_peak_mw"]
    assert all(p["scenario_mw"] <= p["baseline_mw"] for p in solar["points"])


def test_whatif_validation(client):
    assert client.post("/api/whatif", json={"temp_delta_c": 50}).status_code == 422
    assert client.post("/api/whatif", json={"rooftop_solar_mw": -1}).status_code == 422


def test_whatif_capacity_breach_flag(client):
    body = client.post("/api/whatif", json={"temp_delta_c": 4, "rooftop_solar_mw": 0, "horizon": 24, "capacity_mw": 3000}).json()
    assert body["capacity_breach"] is True


# ---------------------------------------------------------------- model mode
def test_model_mode_forecast_uses_ml(model_client):
    body = model_client.get("/api/forecast?horizon=24").json()
    assert body["forecast_method"] == "ml_model"
    assert body["model_name"] == "hist_gradient_boosting"
    assert body["model_data_source"] == "demo"
    assert len(body["points"]) == 24
    assert all(1500 < p["predicted_mw"] < 12000 for p in body["points"])
    _walk(body)


def test_model_mode_actual_backtest(model_client):
    body = model_client.get("/api/actual?hours=24").json()
    assert body["prediction_method"] == "ml_model_1h_backtest"
    err = [abs(p["actual_mw"] - p["predicted_mw"]) for p in body["points"] if p["predicted_mw"] is not None]
    assert err and sum(err) / len(err) < 600


def test_model_mode_whatif_is_monotonic_in_temperature(model_client):
    base = model_client.post("/api/whatif", json={"temp_delta_c": 0, "rooftop_solar_mw": 0}).json()
    hot = model_client.post("/api/whatif", json={"temp_delta_c": 3, "rooftop_solar_mw": 0}).json()
    assert hot["forecast_method"] == "ml_model"
    assert hot["scenario_peak_mw"] > base["baseline_peak_mw"]


def test_model_card(model_client):
    body = model_client.get("/api/model").json()
    assert body["loaded"] is True
    assert body["data_source"] == "demo"
    assert body["baseline_mae"] > body["model_mae"] > 0
    assert body["improvement_pct"] > 0
    assert body["feature_importance"] and {"feature", "label", "importance_mae"} <= set(body["feature_importance"][0])
