"""Recent actual demand versus a 1-hour-ahead backtest prediction.

The "predicted" series is what the model would have said one hour ahead
using true lags (in-sample for the demo model). It is labelled as a backtest
because it is more optimistic than a genuine multi-hour forecast.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from backend.services.data_store import store
from backend.utils.time import iso, mw
from ml.features import build_features


def _backtest(history: pd.DataFrame, hours: int) -> tuple[np.ndarray, str]:
    tail = history.tail(hours + 24 * 8).copy()  # warm-up for 168 h lags
    predictor = store.predictor
    if predictor is not None:
        try:
            feats = build_features(tail)
            X = feats[predictor.feature_columns].astype(float).tail(hours)
            ok = X.notna().all(axis=1)
            preds = np.full(len(X), np.nan)
            if ok.any():
                preds[ok.to_numpy()] = predictor.model.predict(X[ok])
            return preds, "ml_model_1h_backtest"
        except Exception:
            pass
    recent = tail.set_index("timestamp")["demand_mw"]
    by_hour = recent.tail(24 * 7).groupby(recent.tail(24 * 7).index.hour).mean()
    preds = np.array([by_hour.get(t.hour, np.nan) for t in recent.tail(hours).index])
    return preds, "heuristic_same_hour_mean"


def build_actual_response(hours: int) -> dict:
    key = ("actual", hours, id(store.predictor), str(store.origin))
    cached = store.cache_get(key)
    if cached is not None:
        return cached
    hist = store.history.dropna(subset=["demand_mw"])
    preds, method = _backtest(hist, hours)
    tail = hist.tail(hours)
    points = [
        {
            "ts": iso(r.timestamp),
            "actual_mw": mw(r.demand_mw),
            "predicted_mw": mw(p) if pd.notna(p) else None,
            "temp_c": round(float(r.temperature_c), 1) if "temperature_c" in tail and pd.notna(r.temperature_c) else None,
        }
        for r, p in zip(tail.itertuples(), preds)
    ]
    resp = {
        "data_source": store.history_source,
        "prediction_method": method,
        "as_of": iso(store.origin),
        "points": points,
    }
    store.cache_set(key, resp)
    return resp
