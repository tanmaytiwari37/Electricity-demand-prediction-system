"""Forecast accuracy metrics.

Besides the usual point metrics we report daily-peak metrics because the
product story is about *peaks*: an operator cares whether the model gets the
size and the hour of the daily maximum right.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def _arrays(y_true, y_pred) -> tuple[np.ndarray, np.ndarray]:
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_pred, dtype=float)
    mask = ~(np.isnan(yt) | np.isnan(yp))
    return yt[mask], yp[mask]


def mae(y_true, y_pred) -> float:
    yt, yp = _arrays(y_true, y_pred)
    return float(np.mean(np.abs(yt - yp))) if len(yt) else float("nan")


def rmse(y_true, y_pred) -> float:
    yt, yp = _arrays(y_true, y_pred)
    return float(np.sqrt(np.mean((yt - yp) ** 2))) if len(yt) else float("nan")


def mape(y_true, y_pred) -> float:
    """Mean absolute percentage error, ignoring near-zero actuals."""
    yt, yp = _arrays(y_true, y_pred)
    keep = np.abs(yt) > 1e-6
    if not keep.any():
        return float("nan")
    return float(np.mean(np.abs((yt[keep] - yp[keep]) / yt[keep])) * 100)


def daily_peak_metrics(ts: pd.Series, y_true, y_pred) -> dict[str, float]:
    """MAE of the daily maximum and share of days where the predicted peak hour
    falls within +/-1 hour of the actual peak hour."""
    df = pd.DataFrame({"ts": pd.to_datetime(ts), "y": np.asarray(y_true, float), "p": np.asarray(y_pred, float)})
    df = df.dropna()
    if df.empty:
        return {"daily_peak_mae": float("nan"), "peak_hour_hit_rate": float("nan")}
    df["day"] = df["ts"].dt.date
    peak_errors, hits = [], []
    for _, g in df.groupby("day"):
        if len(g) < 12:
            continue
        i_true, i_pred = g["y"].idxmax(), g["p"].idxmax()
        peak_errors.append(abs(g.loc[i_true, "y"] - g.loc[i_pred, "p"]))
        hits.append(abs(g.loc[i_true, "ts"].hour - g.loc[i_pred, "ts"].hour) <= 1)
    if not peak_errors:
        return {"daily_peak_mae": float("nan"), "peak_hour_hit_rate": float("nan")}
    return {
        "daily_peak_mae": float(np.mean(peak_errors)),
        "peak_hour_hit_rate": float(np.mean(hits) * 100),
    }


def evaluate(y_true, y_pred, ts: pd.Series | None = None) -> dict[str, float]:
    out = {"mae": mae(y_true, y_pred), "rmse": rmse(y_true, y_pred), "mape": mape(y_true, y_pred)}
    if ts is not None:
        out.update(daily_peak_metrics(ts, y_true, y_pred))
    return {k: round(v, 3) if v == v else v for k, v in out.items()}


def improvement_pct(baseline_mae: float, model_mae: float) -> float:
    if not baseline_mae or baseline_mae != baseline_mae:
        return float("nan")
    return round((baseline_mae - model_mae) / baseline_mae * 100, 2)
