"""ML pipeline tests: loading/validation, cleaning, features (leakage), baselines,
training, inference and metrics."""

from datetime import datetime
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import pytest

from ml.baseline import SameHourPreviousDay
from ml.data.loader import clean_history, normalize_columns, validate_schema
from ml.demo_data import generate_demo_history, generate_demo_weather
from ml.evaluation.metrics import evaluate, improvement_pct, mae, mape, rmse
from ml.features import LAG_FEATURES, build_features, select_feature_columns, training_frame
from ml.inference.predictor import DemandPredictor
from ml.schema import SchemaError

IST = ZoneInfo("Asia/Kolkata")
NOW = datetime(2026, 9, 4, 10, tzinfo=IST)


# ------------------------------------------------------------------ loader
def test_normalize_columns_maps_aliases():
    df = pd.DataFrame({"Datetime": [], "Load MW": [], "Temp": []})
    out = normalize_columns(df)
    assert list(out.columns) == ["timestamp", "load_mw", "temperature_c"] or "timestamp" in out.columns


def test_validate_schema_missing_required_gives_useful_message():
    with pytest.raises(SchemaError) as exc:
        validate_schema(pd.DataFrame({"timestamp": [1], "temperature_c": [2]}))
    assert "demand_mw" in str(exc.value)
    assert "aliases" in str(exc.value)


def test_clean_history_dedupes_fills_gaps_and_flags_outliers():
    ts = pd.date_range("2026-01-01", periods=24 * 20, freq="h", tz=IST)
    df = pd.DataFrame({"timestamp": ts, "demand_mw": 4000 + 500 * np.sin(np.arange(len(ts)) / 24 * 2 * np.pi)})
    df = pd.concat([df, df.iloc[[5]]])            # duplicate row
    df = df.drop(index=[10, 11])                  # 2-hour gap -> interpolated
    df.loc[100, "demand_mw"] = 90000              # outlier
    df.loc[200, "demand_mw"] = 0                  # non-positive
    clean, report = clean_history(df.reset_index(drop=True), "unit")
    assert report.duplicates_dropped == 1
    assert report.gaps_interpolated == 2
    assert report.outliers_flagged == 2
    assert len(clean) == 24 * 20
    assert clean["timestamp"].diff().dropna().nunique() == 1


def test_clean_history_localizes_naive_timestamps_to_ist(demo_history):
    df, report = demo_history
    assert str(df["timestamp"].dt.tz) == "Asia/Kolkata"
    assert report.coverage_days == pytest.approx(120, abs=0.1)


# ---------------------------------------------------------------- features
def test_features_have_no_leakage(demo_history):
    df, _ = demo_history
    feats = build_features(df)
    y = feats["demand_mw"]
    assert np.allclose(feats["lag_1h"].iloc[1:], y.iloc[:-1])
    assert np.allclose(feats["lag_24h"].iloc[24:], y.iloc[:-24])
    # rolling mean over the previous 24 h must exclude the current hour
    i = 500
    assert feats["rolling_mean_24h"].iloc[i] == pytest.approx(y.iloc[i - 24:i].mean())
    assert feats["lag_168h"].iloc[:168].isna().all()


def test_feature_selection_adapts_to_missing_columns(demo_history):
    df, _ = demo_history
    no_weather = df.drop(columns=["temperature_c", "humidity", "wind_speed", "solar_generation_mw"])
    cols = select_feature_columns(build_features(no_weather))
    assert "temperature_c" not in cols and "humidity" not in cols
    assert set(LAG_FEATURES) <= set(cols)
    assert "is_holiday" in cols and "hour" in cols


def test_training_frame_drops_warmup_rows(demo_history):
    df, _ = demo_history
    feats = build_features(df)
    cols = select_feature_columns(feats)
    X, y, ts = training_frame(feats, cols)
    assert len(X) == len(df) - 168
    assert not X[LAG_FEATURES].isna().any().any()


# ---------------------------------------------------------------- metrics
def test_metrics_basic():
    y, p = [100, 200, 300], [110, 190, 330]
    assert mae(y, p) == pytest.approx(16.667, abs=1e-3)
    assert rmse(y, p) == pytest.approx(np.sqrt((100 + 100 + 900) / 3))
    assert mape(y, p) == pytest.approx((10 / 100 + 10 / 200 + 30 / 300) / 3 * 100)
    assert improvement_pct(100, 75) == 25.0
    out = evaluate(y, p)
    assert set(out) == {"mae", "rmse", "mape"}


def test_baseline_is_lag24(demo_history):
    df, _ = demo_history
    feats = build_features(df).dropna(subset=["lag_24h"])
    assert np.allclose(SameHourPreviousDay().predict(feats), feats["lag_24h"])


# ---------------------------------------------------------------- training
def test_training_beats_baseline_and_saves_artifact(trained_artifact):
    result, path = trained_artifact
    assert path.exists()
    m = result.metrics
    assert m["model_mae"] < m["baseline_mae"]
    assert m["improvement_pct"] > 20
    assert m["rows"]["train"] > m["rows"]["validation"] > 0
    assert result.residual_quantiles["p10"] < result.residual_quantiles["p90"]
    assert result.feature_importance[0]["importance_mae"] >= result.feature_importance[-1]["importance_mae"]
    assert result.metadata["data_source"] == "demo"


def test_training_split_is_chronological(trained_artifact):
    result, _ = trained_artifact
    tp = result.metrics["test_period"]
    assert tp["start"] < tp["end"]
    assert tp["end"].startswith("2026-09-04")


# ---------------------------------------------------------------- inference
def test_predictor_output_shape_and_bands(trained_artifact, demo_history):
    _, path = trained_artifact
    df, _ = demo_history
    predictor = DemandPredictor.load(path)
    weather = generate_demo_weather(NOW.replace(hour=11), 48)
    out = predictor.predict_horizon(df, weather, 48)
    assert len(out) == 48
    assert out["timestamp"].iloc[0] == pd.Timestamp("2026-09-04T11:00", tz=IST)
    assert (out["lower_mw"] <= out["predicted_mw"]).all() and (out["predicted_mw"] <= out["upper_mw"]).all()
    width = out["upper_mw"] - out["lower_mw"]
    assert width.iloc[-1] > width.iloc[0]  # band widens with lead time
    assert out["predicted_mw"].between(1500, 12000).all()


def test_predictor_requires_history(trained_artifact, demo_history):
    _, path = trained_artifact
    df, _ = demo_history
    with pytest.raises(ValueError):
        DemandPredictor.load(path).predict_horizon(df.tail(100), None, 24)


def test_predictor_works_without_future_weather(trained_artifact, demo_history):
    _, path = trained_artifact
    df, _ = demo_history
    out = DemandPredictor.load(path).predict_horizon(df, None, 24)
    assert len(out) == 24 and out["predicted_mw"].notna().all()


# ---------------------------------------------------------------- demo data
def test_demo_history_is_deterministic_and_plausible():
    a, fa = generate_demo_history(NOW, days=30, future_hours=24)
    b, fb = generate_demo_history(NOW, days=30, future_hours=24)
    pd.testing.assert_frame_equal(a, b)
    assert len(a) == 30 * 24 and len(fa) == 24
    assert fa["timestamp"].iloc[0] == a["timestamp"].iloc[-1] + pd.Timedelta(hours=1)
    assert 2000 < a["demand_mw"].min() and a["demand_mw"].max() < 9500


# ---------------------------------------------------------------- risk rules
def test_risk_level_thresholds():
    from backend.services.alert_service import risk_level

    assert risk_level(50) == "low"
    assert risk_level(85) == "medium"
    assert risk_level(92) == "high"
    assert risk_level(97) == "critical"
    assert risk_level(120) == "critical"


def test_assess_groups_consecutive_hours_into_windows():
    from backend.services.alert_service import assess

    ts = pd.date_range("2026-09-04T11:00", periods=24, freq="h", tz=IST)
    pred = np.full(24, 5000.0)
    pred[3:6] = 8000   # one window, high
    pred[10] = 8400    # second window, critical
    frame = pd.DataFrame({"timestamp": ts, "predicted_mw": pred})
    res = assess(frame, 8500.0, "test")
    assert res["risk_level"] == "critical"
    assert len(res["alerts"]) == 2
    assert res["alerts"][0]["level"] == "high" and res["alerts"][0]["window_end"].startswith("2026-09-04T16")
    assert res["alerts"][1]["level"] == "critical" and res["alerts"][1]["headroom_pct"] == pytest.approx(1.2, abs=0.05)
    assert res["hours_at_risk"] == 4
