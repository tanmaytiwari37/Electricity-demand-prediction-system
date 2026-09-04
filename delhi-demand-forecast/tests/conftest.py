"""Shared fixtures. The API is exercised in DEMO MODE with a frozen clock,
weather disabled (no network in CI) and background training disabled, so
tests are fast and deterministic. A small demo model is trained once per
session for the model-mode tests."""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

os.environ.setdefault("PEAKWATCH_FIXED_NOW", "2026-09-04T10:00:00+05:30")
os.environ.setdefault("PEAKWATCH_WEATHER_ENABLED", "false")
os.environ.setdefault("PEAKWATCH_AUTO_TRAIN_DEMO", "false")
os.environ.setdefault("PEAKWATCH_DEMO_HISTORY_DAYS", "120")
_MODEL_DIR = Path(__file__).resolve().parent / "_artifacts"
os.environ.setdefault("PEAKWATCH_DEMO_MODEL_PATH", str(_MODEL_DIR / "test_demo_model.joblib"))
os.environ.setdefault("PEAKWATCH_MODEL_PATH", str(_MODEL_DIR / "missing.joblib"))

IST = ZoneInfo("Asia/Kolkata")
NOW = datetime(2026, 9, 4, 10, tzinfo=IST)


@pytest.fixture(scope="session")
def demo_history():
    from ml.data.loader import clean_history
    from ml.demo_data import generate_demo_history

    hist, _ = generate_demo_history(NOW, days=120)
    df, report = clean_history(hist, "test")
    return df, report


@pytest.fixture(scope="session")
def trained_artifact(demo_history, tmp_path_factory):
    from ml.training.train import TrainConfig, save_artifact, train_from_dataframe

    df, _ = demo_history
    cfg = TrainConfig(candidates=("hist_gradient_boosting",), importance_sample=300, data_source="demo")
    result = train_from_dataframe(df, cfg)
    path = tmp_path_factory.mktemp("model") / "demo_model.joblib"
    save_artifact(result, path)
    return result, path


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from backend.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def model_client(client, trained_artifact):
    """Same app, with the trained artifact injected into the data store."""
    from backend.services.data_store import store
    from ml.inference.predictor import DemandPredictor

    _, path = trained_artifact
    previous = (store.predictor, store.model_status)
    store.predictor, store.model_status = DemandPredictor.load(path), "loaded"
    store.invalidate()
    yield client
    store.predictor, store.model_status = previous
    store.invalidate()
