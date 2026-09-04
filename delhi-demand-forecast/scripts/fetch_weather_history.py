"""Attach weather to a demand CSV and write the hourly training file.

Weather comes from one of two places, and the script states which one it used:

* ``--weather-csv PATH``  a supplied hourly weather file. Its provenance is
  whatever the supplier says it is; the script labels it ``supplied_file``
  and never claims it came from Open-Meteo.
* otherwise               the Open-Meteo archive (REAL, no API key) for the
  demand CSV's date range. Retries once on failure, then falls back to
  fetching quarter by quarter.

Sub-hourly demand (e.g. a 5-minute SLDC export) is aggregated to the hour:
``demand_mw`` = hourly MEAN (the training target) and ``demand_max_mw`` =
hourly MAX, kept only to quantify the instantaneous-peak margin. It is never
used as a feature. Existing weather columns in the demand CSV are kept.

A ``<out>.provenance.json`` sidecar records the inputs and the aggregation.

Usage:
    python scripts/fetch_weather_history.py --csv data/raw/delhi_load_history.csv \
        --weather-csv data/raw/delhi_weather_history.csv --out data/processed/delhi_history.csv
    python scripts/fetch_weather_history.py --csv data/raw/delhi_load.csv --out data/processed/delhi_history.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.services.weather_service import fetch_open_meteo_archive  # noqa: E402
from ml.data.loader import normalize_columns, parse_timestamps  # noqa: E402
from ml.schema import TARGET, TIMESTAMP, WEATHER_COLUMNS  # noqa: E402

HOURLY_MAX = "demand_max_mw"
WEATHER_KEEP = list(WEATHER_COLUMNS) + ["solar_generation_mw"]


def aggregate_hourly(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Mean/max of sub-hourly demand per clock hour. Hourly input passes through."""
    step_min = float(df[TIMESTAMP].diff().dt.total_seconds().mode().iloc[0] / 60) if len(df) > 1 else 60.0
    if step_min >= 60:
        return df, {"input_step_minutes": step_min, "aggregation": "none (already hourly)"}
    out = df.copy()
    out[TIMESTAMP] = out[TIMESTAMP].dt.floor("h")
    out[TARGET] = pd.to_numeric(out[TARGET], errors="coerce")
    agg = {TARGET: "mean", HOURLY_MAX: "max"}
    out[HOURLY_MAX] = out[TARGET]
    for col in out.select_dtypes(include="number").columns:
        if col not in agg:
            agg[col] = "mean"
    hourly = out.groupby(TIMESTAMP, as_index=False).agg(agg)
    samples = out.groupby(TIMESTAMP)[TARGET].count()
    info = {
        "input_step_minutes": step_min,
        "aggregation": f"{TARGET} = hourly mean of {step_min:g}-min readings; {HOURLY_MAX} = hourly max",
        "rows_sub_hourly": int(len(df)),
        "rows_hourly": int(len(hourly)),
        "hours_with_partial_samples": int((samples < 60 / step_min).sum()),
    }
    return hourly, info


def load_weather_csv(path: Path) -> pd.DataFrame:
    """Supplied hourly weather -> canonical columns, IST, floored to the hour."""
    w = parse_timestamps(normalize_columns(pd.read_csv(path)))
    w[TIMESTAMP] = w[TIMESTAMP].dt.floor("h")
    keep = [TIMESTAMP] + [c for c in WEATHER_KEEP if c in w.columns]
    if len(keep) == 1:
        raise SystemExit(f"{path} has no recognised weather columns (expected e.g. temperature_2m/temperature_c).")
    return w[keep].drop_duplicates(TIMESTAMP)


def fetch_archive_with_fallback(start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    """Whole range, retried once; then quarter-by-quarter so a slow network still completes."""
    fmt = "%Y-%m-%d"
    for attempt in (1, 2):
        try:
            return fetch_open_meteo_archive(start.strftime(fmt), end.strftime(fmt))
        except Exception as exc:  # network / HTTP - fall through to chunked fetch
            print(f"  archive fetch attempt {attempt} failed: {exc}")
    print("  falling back to quarterly chunks ...")
    parts = []
    for q_start in pd.date_range(start.normalize(), end.normalize(), freq="QS", inclusive="left").union([start.normalize()]):
        q_end = min(q_start + pd.DateOffset(months=3) - pd.Timedelta(days=1), end.normalize())
        if q_end < q_start:
            continue
        print(f"  fetching {q_start.strftime(fmt)} -> {q_end.strftime(fmt)}")
        parts.append(fetch_open_meteo_archive(q_start.strftime(fmt), q_end.strftime(fmt)))
    return pd.concat(parts, ignore_index=True).drop_duplicates(TIMESTAMP)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", type=Path, required=True, help="demand CSV (hourly or sub-hourly)")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--weather-csv", type=Path, default=None, help="supplied hourly weather file; omit to use the Open-Meteo archive")
    args = ap.parse_args()

    df = parse_timestamps(normalize_columns(pd.read_csv(args.csv)))
    df, agg_info = aggregate_hourly(df)
    start, end = df[TIMESTAMP].min(), df[TIMESTAMP].max()
    print(f"Demand: {len(df)} hourly rows {start} -> {end} ({agg_info['aggregation']})")

    if args.weather_csv is not None:
        weather = load_weather_csv(args.weather_csv)
        weather_source = f"supplied_file:{args.weather_csv.as_posix()}"
        print(f"Weather: supplied file {args.weather_csv} ({len(weather)} hourly rows, provenance NOT verified)")
    else:
        print(f"Weather: fetching Open-Meteo archive {start.date()} -> {end.date()} ...")
        weather = fetch_archive_with_fallback(start, end)
        weather_source = "open_meteo_archive"

    keep = [c for c in weather.columns if c == TIMESTAMP or c not in df.columns]
    merged = df.merge(weather[keep], on=TIMESTAMP, how="left")
    weather_cols = [c for c in keep if c != TIMESTAMP]
    coverage = {c: round(float(merged[c].notna().mean() * 100), 2) for c in weather_cols}

    args.out.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(args.out, index=False)
    provenance = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "demand_source": args.csv.as_posix(),
        "weather_source": weather_source,
        "weather_columns": weather_cols,
        "weather_coverage_pct": coverage,
        "start": start.isoformat(), "end": end.isoformat(),
        **agg_info,
    }
    sidecar = args.out.with_suffix(".provenance.json")
    sidecar.write_text(json.dumps(provenance, indent=2))
    print(f"Wrote {len(merged)} rows to {args.out}; weather columns {weather_cols} coverage {coverage}")
    print(f"Provenance written to {sidecar}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
