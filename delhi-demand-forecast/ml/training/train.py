"""Training pipeline: split -> baselines -> candidate models -> select -> artifact.

The split is strictly chronological (train | validation | test) so no future
information leaks backwards. Candidates are compared on the validation set,
the winner is scored once on the untouched test set, then refit on
train+validation for deployment. Prediction bands come from the empirical
P10/P90 of the deployed model's out-of-sample residuals over a rolling recent
window (see ``ml.evaluation.calibration``); no distributional assumption.
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.inspection import permutation_importance

from ml.baseline import BASELINES
from ml.evaluation.calibration import quantile_band, recent_window_band, rolling_coverage, static_coverage
from ml.evaluation.metrics import evaluate, improvement_pct
from ml.features import FEATURE_LABELS, build_features, select_feature_columns, training_frame
from ml.schema import TARGET, TIMESTAMP

ARTIFACT_VERSION = 1


@dataclass
class TrainConfig:
    val_fraction: float = 0.15
    test_fraction: float = 0.15
    candidates: tuple[str, ...] = ("hist_gradient_boosting", "random_forest")
    random_state: int = 42
    importance_sample: int = 2000  # rows used for permutation importance
    calibration_window_days: int = 28  # recent out-of-sample residuals that set the served P10-P90 band
    data_source: str = "real"  # "real" | "demo" - stored in the artifact, surfaced in the UI
    notes: str = ""


@dataclass
class TrainingResult:
    model: Any
    model_name: str
    feature_columns: list[str]
    metrics: dict[str, Any]
    feature_importance: list[dict[str, Any]]
    residual_quantiles: dict[str, float]
    metadata: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> dict[str, Any]:
        return {
            "model_name": self.model_name,
            "feature_columns": self.feature_columns,
            "metrics": self.metrics,
            "feature_importance": self.feature_importance,
            "residual_quantiles": self.residual_quantiles,
            "metadata": self.metadata,
        }


# --------------------------------------------------------------------------- #
def make_candidate(name: str, random_state: int):
    if name == "hist_gradient_boosting":
        return HistGradientBoostingRegressor(
            max_iter=400, learning_rate=0.06, max_leaf_nodes=31, min_samples_leaf=40,
            l2_regularization=0.5, random_state=random_state,
        )
    if name == "random_forest":
        return RandomForestRegressor(
            n_estimators=200, min_samples_leaf=5, max_features=0.6, n_jobs=-1, random_state=random_state,
        )
    raise ValueError(f"Unknown candidate model '{name}'")


def split_by_time(n: int, val_fraction: float, test_fraction: float) -> tuple[slice, slice, slice]:
    n_test = int(n * test_fraction)
    n_val = int(n * val_fraction)
    n_train = n - n_val - n_test
    if n_train < 24 * 14:
        raise ValueError(f"Not enough rows to train: {n} rows after feature warm-up.")
    return slice(0, n_train), slice(n_train, n_train + n_val), slice(n_train + n_val, n)


def train_from_dataframe(df: pd.DataFrame, config: TrainConfig | None = None) -> TrainingResult:
    """Train on a *cleaned* hourly frame (see ml.data.loader.clean_history)."""
    config = config or TrainConfig()
    t0 = time.time()

    feats = build_features(df)
    feature_cols = select_feature_columns(feats)
    X, y, ts = training_frame(feats, feature_cols)
    X, y, ts = X.reset_index(drop=True), y.reset_index(drop=True), ts.reset_index(drop=True)

    tr, va, te = split_by_time(len(X), config.val_fraction, config.test_fraction)
    X_tr, y_tr = X.iloc[tr], y.iloc[tr]
    X_va, y_va = X.iloc[va], y.iloc[va]
    X_te, y_te, ts_te = X.iloc[te], y.iloc[te], ts.iloc[te]

    # Baselines (scored on validation and test)
    baseline_metrics = {}
    for b in BASELINES:
        if b.feature in feature_cols:
            baseline_metrics[b.name] = {
                "validation": evaluate(y_va, b.predict(X_va)),
                "test": evaluate(y_te, b.predict(X_te), ts_te),
            }

    # Candidates
    candidate_metrics, fitted = {}, {}
    for name in config.candidates:
        model = make_candidate(name, config.random_state)
        model.fit(X_tr, y_tr)
        fitted[name] = model
        candidate_metrics[name] = {"validation": evaluate(y_va, model.predict(X_va))}

    best_name = min(candidate_metrics, key=lambda k: candidate_metrics[k]["validation"]["mae"])
    best = fitted[best_name]
    candidate_metrics[best_name]["test"] = evaluate(y_te, best.predict(X_te), ts_te)

    # Static band (original scheme): validation-split quantiles applied to the whole
    # test window. Kept only as the comparison figure; it under-covers when error
    # size drifts with the season.
    static_band = quantile_band(y_va.to_numpy() - best.predict(X_va))
    static_cov = static_coverage(y_te.to_numpy() - best.predict(X_te), static_band)

    # Permutation importance on a test subsample (model-agnostic, no fabrication)
    n_imp = min(config.importance_sample, len(X_te))
    rng = np.random.default_rng(config.random_state)
    idx = rng.choice(len(X_te), size=n_imp, replace=False) if n_imp < len(X_te) else np.arange(len(X_te))
    pi = permutation_importance(best, X_te.iloc[idx], y_te.iloc[idx], n_repeats=5,
                                random_state=config.random_state, scoring="neg_mean_absolute_error")
    importance = sorted(
        (
            {"feature": c, "label": FEATURE_LABELS.get(c, c),
             "importance_mae": float(pi.importances_mean[i]), "std": float(pi.importances_std[i])}
            for i, c in enumerate(feature_cols)
        ),
        key=lambda d: d["importance_mae"], reverse=True,
    )

    # Refit chosen model on train + validation for deployment
    final_model = make_candidate(best_name, config.random_state)
    final_model.fit(pd.concat([X_tr, X_va]), pd.concat([y_tr, y_va]))

    # Served band: P10/P90 of the *deployed* model's residuals on the held-out test
    # window (out-of-sample for it too), taken over the most recent calibration
    # window. Coverage is measured with the same rolling rule, so the reported
    # number is what the served band would have achieved, hour by hour.
    window_h = config.calibration_window_days * 24
    resid_te = y_te.to_numpy() - final_model.predict(X_te)
    rolling = rolling_coverage(resid_te, window_h)
    if rolling["n_scored"] > 0:
        residual_quantiles = recent_window_band(resid_te, window_h)
        n_cal = min(window_h, len(ts_te))
        calibration = {
            "method": "rolling_recent_window",
            "window_days": config.calibration_window_days,
            "coverage_pct": rolling["coverage_pct"],
            "n_scored": rolling["n_scored"],
            "calibrated_on": {"start": ts_te.iloc[-n_cal].isoformat(), "end": ts_te.iloc[-1].isoformat()},
            "static_validation_split_coverage_pct": round(static_cov, 1),
        }
        coverage = rolling["coverage_pct"]
    else:  # test window shorter than a week: fall back to the static scheme, labelled
        residual_quantiles = static_band
        calibration = {"method": "static_validation_split", "coverage_pct": round(static_cov, 1)}
        coverage = static_cov

    primary_baseline = "same_hour_previous_day" if "same_hour_previous_day" in baseline_metrics else next(iter(baseline_metrics), None)
    base_mae = baseline_metrics[primary_baseline]["test"]["mae"] if primary_baseline else float("nan")
    model_mae = candidate_metrics[best_name]["test"]["mae"]

    metrics = {
        "baselines": baseline_metrics,
        "candidates": candidate_metrics,
        "selected": best_name,
        "primary_baseline": primary_baseline,
        "baseline_mae": base_mae,
        "model_mae": model_mae,
        "improvement_pct": improvement_pct(base_mae, model_mae),
        "interval_coverage_pct": round(coverage, 1),
        "interval_calibration": calibration,
        "rows": {"train": len(X_tr), "validation": len(X_va), "test": len(X_te)},
        "test_period": {"start": ts_te.iloc[0].isoformat(), "end": ts_te.iloc[-1].isoformat()},
    }
    metadata = {
        "artifact_version": ARTIFACT_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_seconds": round(time.time() - t0, 1),
        "data_source": config.data_source,
        "history_start": df[TIMESTAMP].min().isoformat(),
        "history_end": df[TIMESTAMP].max().isoformat(),
        "n_rows": int(len(df)),
        "config": asdict(config),
        "notes": config.notes,
    }
    return TrainingResult(final_model, best_name, feature_cols, metrics, importance, residual_quantiles, metadata)


def save_artifact(result: TrainingResult, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": result.model,
            "model_name": result.model_name,
            "feature_columns": result.feature_columns,
            "metrics": result.metrics,
            "feature_importance": result.feature_importance,
            "residual_quantiles": result.residual_quantiles,
            "metadata": result.metadata,
        },
        path,
    )
    return path


def train_from_csv(csv_path: str | Path, out_path: str | Path, config: TrainConfig | None = None) -> TrainingResult:
    from ml.data.loader import load_history_csv

    df, report = load_history_csv(csv_path)
    config = config or TrainConfig()
    result = train_from_dataframe(df, config)
    result.metadata["dataset_report"] = report.to_dict()
    save_artifact(result, out_path)
    return result
