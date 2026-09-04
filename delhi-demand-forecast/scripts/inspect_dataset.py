"""Inspect a historical demand + weather CSV BEFORE training on it.

Runs the pre-training checklist: schema, timestamps, missing values,
duplicates, units, outliers, demand distribution, temperature relationship,
coverage, and suitability for 24 h / 7 d forecasting. Prints a report and
writes JSON next to the processed data so the decision to train is recorded.

Usage:
    python scripts/inspect_dataset.py data/raw/delhi_load.csv
    python scripts/inspect_dataset.py data/raw/delhi_load.csv --out data/processed/inspection_report.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.data.loader import clean_history, normalize_columns, validate_schema  # noqa: E402
from ml.schema import TARGET, TIMESTAMP, SchemaError  # noqa: E402


def check_units(clean: pd.DataFrame) -> list[str]:
    notes = []
    med = clean[TARGET].median()
    if med < 50:
        notes.append(f"Median demand {med:.2f}: looks like GW, not MW. Multiply by 1000 before training.")
    elif med > 100_000:
        notes.append(f"Median demand {med:.0f}: looks like kW, not MW. Divide by 1000 before training.")
    elif not 1500 < med < 9000:
        notes.append(f"Median demand {med:.0f} MW is outside the expected Delhi range (about 2,000-8,500 MW). Verify units/scope.")
    if "temperature_c" in clean.columns:
        t = clean["temperature_c"].dropna()
        if len(t) and (t.median() > 60 or t.max() > 70):
            notes.append("Temperature looks like Fahrenheit or Kelvin; expected degC.")
    return notes


def temperature_relationship(clean: pd.DataFrame) -> dict:
    if "temperature_c" not in clean.columns:
        return {"available": False}
    df = clean[[TARGET, "temperature_c"]].dropna()
    if len(df) < 100:
        return {"available": False, "note": "fewer than 100 rows with temperature"}
    corr = float(np.corrcoef(df["temperature_c"], df[TARGET])[0, 1])
    hot = df[df["temperature_c"] > 26]
    slope = float(np.polyfit(hot["temperature_c"], hot[TARGET], 1)[0]) if len(hot) > 50 else None
    return {"available": True, "pearson_r": round(corr, 3), "slope_mw_per_degc_above_26c": round(slope, 1) if slope else None}


def suitability(report: dict, clean: pd.DataFrame) -> dict:
    days = report["coverage_days"]
    missing = report["missing_target_pct"]
    months = clean[TIMESTAMP].dt.to_period("M").nunique()
    out = {
        "forecast_24h": days >= 60 and missing < 15,
        "forecast_7d": days >= 180 and missing < 15,
        "seasonal_generalisation": months >= 12,
        "reasons": [],
    }
    if days < 60:
        out["reasons"].append("under 60 days of data: not enough to learn weekly patterns")
    if days < 180:
        out["reasons"].append("under 180 days: 7-day forecasts will lack seasonal context")
    if months < 12:
        out["reasons"].append("less than a full year: model will not have seen every season")
    if missing >= 15:
        out["reasons"].append("more than 15 % missing demand values")
    return out


def inspect(path: Path) -> dict:
    raw = pd.read_csv(path)
    report: dict = {"file": str(path), "rows_raw": int(len(raw)), "raw_columns": list(raw.columns)}

    normalized = normalize_columns(raw)
    try:
        report["optional_missing"] = validate_schema(normalized)
        report["schema_ok"] = True
    except SchemaError as exc:
        report["schema_ok"] = False
        report["schema_error"] = str(exc)
        return report

    ts = pd.to_datetime(normalized[TIMESTAMP], errors="coerce")
    report["timestamps"] = {
        "unparseable": int(ts.isna().sum()),
        "timezone_in_file": str(getattr(ts.dt, "tz", None)),
        "min": str(ts.min()), "max": str(ts.max()),
        "most_common_step_minutes": float(ts.sort_values().diff().dt.total_seconds().mode().iloc[0] / 60) if len(ts) > 1 else None,
        "exact_duplicates": int(ts.duplicated().sum()),
    }
    report["missing_values_raw"] = {c: int(normalized[c].isna().sum()) for c in normalized.columns}

    clean, ds_report = clean_history(raw, source=str(path))
    report["cleaning"] = ds_report.to_dict()
    report["unit_checks"] = check_units(clean)

    y = clean[TARGET].dropna()
    report["demand_distribution_mw"] = {
        "min": round(float(y.min()), 1), "p05": round(float(y.quantile(0.05)), 1), "median": round(float(y.median()), 1),
        "mean": round(float(y.mean()), 1), "p95": round(float(y.quantile(0.95)), 1), "max": round(float(y.max()), 1),
        "monthly_peak": {str(k): round(float(v), 0) for k, v in y.groupby(clean.loc[y.index, TIMESTAMP].dt.to_period("M")).max().items()},
    }
    report["temperature_relationship"] = temperature_relationship(clean)
    report["coverage_days"] = ds_report.coverage_days
    report["suitability"] = suitability(ds_report.to_dict(), clean)
    return report


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=Path)
    ap.add_argument("--out", type=Path, default=None, help="write JSON report here")
    args = ap.parse_args()

    report = inspect(args.csv)
    print(json.dumps(report, indent=2, default=str))
    out = args.out or Path("data/processed") / f"{args.csv.stem}_inspection.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, default=str))
    print(f"\nReport written to {out}")

    if not report.get("schema_ok"):
        print("\nSCHEMA PROBLEM - fix the CSV before training.")
        return 1
    s = report["suitability"]
    print("\nSuitability: 24h forecast:", "YES" if s["forecast_24h"] else "NO", "| 7d forecast:", "YES" if s["forecast_7d"] else "NO")
    for r in s["reasons"] + report["unit_checks"] + report["cleaning"]["warnings"]:
        print(" -", r)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
