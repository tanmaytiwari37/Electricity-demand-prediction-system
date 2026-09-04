"""Write the SIMULATED demo history to data/demo/demo_history.csv.

The API generates this in memory at startup; the CSV exists so the same data
can be inspected, used to rehearse the training scripts, or shared. It is
synthetic and must never be presented as real Delhi load.

Usage:  python scripts/generate_demo_csv.py [--days 730] [--out data/demo/demo_history.csv]
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.demo_data import generate_demo_history  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=730)
    ap.add_argument("--end", default=None, help="ISO timestamp (IST); default = now")
    ap.add_argument("--out", type=Path, default=Path("data/demo/demo_history.csv"))
    args = ap.parse_args()

    end = datetime.fromisoformat(args.end) if args.end else datetime.now(ZoneInfo("Asia/Kolkata"))
    hist, _ = generate_demo_history(end, days=args.days)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    hist.to_csv(args.out, index=False)
    print(f"Wrote {len(hist)} SIMULATED rows to {args.out} ({hist['timestamp'].iloc[0]} -> {hist['timestamp'].iloc[-1]})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
