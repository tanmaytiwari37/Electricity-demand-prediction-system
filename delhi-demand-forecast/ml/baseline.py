"""Naive baselines the ML model must beat to justify itself."""

from __future__ import annotations

import numpy as np
import pandas as pd


class SameHourPreviousDay:
    """Predict demand = demand at the same hour yesterday (lag_24h)."""

    name = "same_hour_previous_day"
    feature = "lag_24h"

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return X[self.feature].to_numpy(dtype=float)


class SameHourPreviousWeek:
    """Predict demand = demand at the same hour last week (lag_168h)."""

    name = "same_hour_previous_week"
    feature = "lag_168h"

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return X[self.feature].to_numpy(dtype=float)


BASELINES = [SameHourPreviousDay(), SameHourPreviousWeek()]
