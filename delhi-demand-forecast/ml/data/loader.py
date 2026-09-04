"""CSV loading, validation and cleaning for the historical dataset.

Pipeline:  read CSV -> normalise column names -> validate schema
           -> parse timestamps (IST) -> sort/dedupe -> regularise to hourly
           -> flag outliers -> report

Every step records what it did in a ``DatasetReport`` so the operator (and
the /api/status endpoint) can see exactly how the raw file was treated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from ml.schema import (
    COLUMN_ALIASES,
    OPTIONAL_COLUMNS,
    REQUIRED_COLUMNS,
    TARGET,
    TIMESTAMP,
    SchemaError,
)

IST = ZoneInfo("Asia/Kolkata")

MAX_GAP_TO_INTERPOLATE_H = 3  # gaps longer than this stay NaN and are dropped from training
OUTLIER_LOW_MW = 500.0  # anything below is treated as a metering fault for a city-scale series
OUTLIER_HIGH_FACTOR = 2.5  # above factor x rolling-median is treated as an outlier


@dataclass
class DatasetReport:
    source: str
    rows_raw: int = 0
    rows_clean: int = 0
    start: str | None = None
    end: str | None = None
    coverage_days: float = 0.0
    columns_present: list[str] = field(default_factory=list)
    optional_missing: list[str] = field(default_factory=list)
    duplicates_dropped: int = 0
    gaps_interpolated: int = 0
    gaps_unfilled: int = 0
    outliers_flagged: int = 0
    missing_target_pct: float = 0.0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return self.__dict__.copy()


# --------------------------------------------------------------------------- #
# Column handling
# --------------------------------------------------------------------------- #
def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lower-case, strip and map known aliases to canonical names."""
    renamed = {}
    for col in df.columns:
        key = str(col).strip().lower().replace(" ", "_")
        renamed[col] = COLUMN_ALIASES.get(key, key)
    out = df.rename(columns=renamed)
    # If two raw columns mapped to the same canonical name keep the first.
    return out.loc[:, ~out.columns.duplicated()]


def validate_schema(df: pd.DataFrame) -> list[str]:
    """Raise SchemaError for missing required columns; return missing optionals."""
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise SchemaError(
            f"Dataset is missing required column(s) {missing}. "
            f"Found columns: {list(df.columns)}. Required: {list(REQUIRED_COLUMNS)}; "
            f"accepted aliases: {sorted(k for k, v in COLUMN_ALIASES.items() if v in missing)}"
        )
    return [c for c in OPTIONAL_COLUMNS if c not in df.columns]


# --------------------------------------------------------------------------- #
# Timestamp handling
# --------------------------------------------------------------------------- #
def parse_timestamps(df: pd.DataFrame, tz: ZoneInfo = IST) -> pd.DataFrame:
    """Parse the timestamp column to timezone-aware IST and sort ascending."""
    ts = pd.to_datetime(df[TIMESTAMP], errors="coerce", utc=False)
    if ts.isna().all():
        raise SchemaError("No parseable values in the timestamp column.")
    if getattr(ts.dt, "tz", None) is None:
        ts = ts.dt.tz_localize(tz, ambiguous="NaT", nonexistent="shift_forward")
    else:
        ts = ts.dt.tz_convert(tz)
    out = df.copy()
    out[TIMESTAMP] = ts
    out = out.dropna(subset=[TIMESTAMP]).sort_values(TIMESTAMP).reset_index(drop=True)
    return out


def regularize_hourly(df: pd.DataFrame, report: DatasetReport) -> pd.DataFrame:
    """Snap to a complete hourly index; fill short gaps by interpolation."""
    df = df.copy()
    df[TIMESTAMP] = df[TIMESTAMP].dt.floor("h")
    before = len(df)
    df = df.groupby(TIMESTAMP, as_index=False).mean(numeric_only=True)
    report.duplicates_dropped = before - len(df)

    full = pd.date_range(df[TIMESTAMP].min(), df[TIMESTAMP].max(), freq="h", tz=IST)
    df = df.set_index(TIMESTAMP).reindex(full)
    df.index.name = TIMESTAMP

    missing_before = int(df[TARGET].isna().sum())
    numeric = df.select_dtypes(include="number").columns
    df[numeric] = df[numeric].interpolate(limit=MAX_GAP_TO_INTERPOLATE_H, limit_area="inside")
    missing_after = int(df[TARGET].isna().sum())
    report.gaps_interpolated = missing_before - missing_after
    report.gaps_unfilled = missing_after
    return df.reset_index()


# --------------------------------------------------------------------------- #
# Outliers
# --------------------------------------------------------------------------- #
def flag_outliers(df: pd.DataFrame, report: DatasetReport) -> pd.DataFrame:
    """Set implausible demand values to NaN (they are excluded from training)."""
    df = df.copy()
    y = df[TARGET].astype(float)
    rolling_median = y.rolling(24 * 7, min_periods=24, center=True).median()
    too_low = y < OUTLIER_LOW_MW
    too_high = y > rolling_median * OUTLIER_HIGH_FACTOR
    non_positive = y <= 0
    mask = (too_low | too_high | non_positive) & y.notna()
    report.outliers_flagged = int(mask.sum())
    df.loc[mask, TARGET] = np.nan
    return df


# --------------------------------------------------------------------------- #
# Entry points
# --------------------------------------------------------------------------- #
def clean_history(df: pd.DataFrame, source: str = "dataframe") -> tuple[pd.DataFrame, DatasetReport]:
    """Full cleaning pass on an already-loaded frame. Returns (clean, report)."""
    report = DatasetReport(source=source, rows_raw=len(df))
    df = normalize_columns(df)
    report.optional_missing = validate_schema(df)
    report.columns_present = [c for c in df.columns]

    df = parse_timestamps(df)
    df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce")
    for col in OPTIONAL_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = regularize_hourly(df, report)
    df = flag_outliers(df, report)

    report.rows_clean = int(df[TARGET].notna().sum())
    report.missing_target_pct = round(float(df[TARGET].isna().mean() * 100), 2)
    report.start = df[TIMESTAMP].min().isoformat()
    report.end = df[TIMESTAMP].max().isoformat()
    report.coverage_days = round((df[TIMESTAMP].max() - df[TIMESTAMP].min()).total_seconds() / 86400, 1)

    if report.coverage_days < 60:
        report.warnings.append("Less than 60 days of history: weekly seasonality and 7-day forecasts will be unreliable.")
    if report.missing_target_pct > 10:
        report.warnings.append(f"{report.missing_target_pct}% of demand values are missing after cleaning.")
    if "temperature_c" not in df.columns:
        report.warnings.append("No temperature column: weather sensitivity cannot be learned.")
    return df, report


def load_history_csv(path: str | Path) -> tuple[pd.DataFrame, DatasetReport]:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    raw = pd.read_csv(path)
    return clean_history(raw, source=str(path))
