"""Train the demand model on a cleaned CSV and save the artifact.

Usage:
    python scripts/train_model.py --csv data/processed/delhi_history.csv
    python scripts/train_model.py --csv data/demo/demo_history.csv --data-source demo --out ml/models/demo_model.joblib

Run scripts/inspect_dataset.py first. Point PEAKWATCH_HISTORY_CSV at the same
CSV and (re)start the API to serve the trained model.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.training.train import TrainConfig, train_from_csv  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=Path("ml/models/model.joblib"))
    ap.add_argument("--data-source", choices=["real", "demo"], default="real")
    ap.add_argument("--candidates", nargs="+", default=["hist_gradient_boosting", "random_forest"])
    ap.add_argument("--notes", default="")
    args = ap.parse_args()

    cfg = TrainConfig(candidates=tuple(args.candidates), data_source=args.data_source, notes=args.notes)
    result = train_from_csv(args.csv, args.out, cfg)
    m = result.metrics
    print(json.dumps({k: v for k, v in m.items() if k not in ("baselines", "candidates")}, indent=2))
    print("\nCandidates (validation MAE):", {k: v["validation"]["mae"] for k, v in m["candidates"].items()})
    print("Top drivers:", [(d["label"], round(d["importance_mae"], 1)) for d in result.feature_importance[:6]])
    print(f"\nSaved {args.out}  (selected {result.model_name}, baseline MAE {m['baseline_mae']:.1f} -> model MAE {m['model_mae']:.1f}, {m['improvement_pct']:.1f}% better)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
