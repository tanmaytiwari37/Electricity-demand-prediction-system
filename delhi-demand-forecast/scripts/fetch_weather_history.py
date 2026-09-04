"""Attach REAL Open-Meteo archive weather to a demand CSV that lacks it.

Usage:
    python scripts/fetch_weather_history.py --csv data/raw/delhi_load.csv --out data/processed/delhi_history.csv

Reads the demand CSV, fetches hourly temperature / humidity / wind for Delhi
over the same date range from the Open-Meteo archive (no API key), merges on
the hour and writes the result. Existing weather columns are kept.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.services.weather_service import fetch_open_meteo_archive  # noqa: E402
from ml.data.loader import normalize_columns, parse_timestamps  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    df = parse_timestamps(normalize_columns(pd.read_csv(args.csv)))
    df["timestamp"] = df["timestamp"].dt.floor("h")
    start, end = df["timestamp"].min().strftime("%Y-%m-%d"), df["timestamp"].max().strftime("%Y-%m-%d")
    print(f"Fetching Open-Meteo archive weather {start} -> {end} ...")
    weather = fetch_open_meteo_archive(start, end)

    keep = [c for c in weather.columns if c == "timestamp" or c not in df.columns]
    merged = df.merge(weather[keep], on="timestamp", how="left")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(args.out, index=False)
    print(f"Wrote {len(merged)} rows to {args.out}; weather columns: {[c for c in keep if c != 'timestamp']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
