# CLAUDE.md

Standing context for Claude Code. Read automatically at the start of every session
in this repo — this is why prompts don't need to re-explain the project.

## What this project is

An AI-based short-term electricity demand forecasting and decision-support system
for Delhi, built for a hackathon. It forecasts next-day load from historical demand
plus weather (temperature is the dominant driver) and presents it as a DISCOM/SLDC
operator dashboard with peak-risk alerts, feeder-wise breakdown, weather-impact
analysis and what-if scenarios.

The audience is a judge watching a 3–5 minute demo. Optimise for *working, legible
and demonstrable* over clever.

## Non-negotiable constraints

- **Free only.** No paid APIs, no cloud services needing a card. Open-Meteo (no key),
  local files, localhost.
- **Must run offline.** If Open-Meteo or any network call fails, fall back to bundled
  data in `data/demo/` and report it accurately. Never crash, never hang, never show
  a white screen.
- **Provenance is never wrong.** Every response carries `data_source`; forecast
  responses also carry `forecast_method` and `weather_source`. These are our honesty
  claim to judges. A response that says `"live"` while serving cache is the worst
  class of bug — worse than an outage, because it is a false statement to a judge.
- **No secrets in code.** Config goes through `.env` (see `.env.example`).

## Stack (as actually installed — do not assume older versions)

- Python 3.13, FastAPI, uvicorn, pydantic v2 + pydantic-settings
- pandas **3.0.x**, numpy 2.5.x, scikit-learn 1.9.x, joblib, holidays
- React + Vite + Tailwind + React Router + Axios + Recharts
- pytest for tests. No database — CSV on disk.

pandas 3.0 is a **major** version with breaking changes from 2.x. Use current 3.x
API; do not copy 2.x idioms from memory.

## Repository layout and ownership

```
ml/               Forecasting pipeline
  data/           CSV loading, cleaning, hourly regularisation
  features.py     Leakage-safe feature engineering
  calendar.py     Indian holidays, calendar features
  baseline.py     Naive baselines (same-hour-yesterday, rolling mean)
  training/       Chronological split, model selection, metrics
  inference/      Recursive multi-hour forecasting
  evaluation/     Backtest, permutation importance, interval calibration
  models/         model.joblib + metrics — the trained artifact
  demo_data.py    Deterministic synthetic Delhi load generator
  schema.py       Column contracts

backend/          FastAPI app, routers, services
scripts/          inspect_dataset.py, train_model.py, generate_demo_csv.py,
                  fetch_weather_history.py
frontend/         React dashboard (Vite)
data/demo/        Committed demo dataset — the offline fallback
tests/            pytest suite
docs/             API contract, architecture, demo script
```

**One owner per folder. When asked to work in one folder, do not modify files in
another.** If a change elsewhere is required, say so and stop — don't make it.

## The API contract is law

The contract in `docs/` defines every endpoint's exact JSON shape. Backend must match
it, frontend must consume it. **Never change a field name, type or nesting without
being told to explicitly** — other people are building against it. If something in
the contract looks wrong, say so; don't silently "improve" it.

Endpoints: `/api/health`, `/api/status`, `/api/forecast`, `/api/actual`, `/api/alerts`,
`/api/feeders`, `/api/weather-impact`, `/api/whatif`, `/api/metrics`.

## Conventions

- Timestamps: ISO 8601 with IST offset, e.g. `2026-09-05T22:00:00+05:30`. Never naive
  datetimes. Always tz-aware pandas. `ZoneInfo("Asia/Kolkata")`.
- Power: MW, float, 1 decimal. Cast numpy floats with `float()` at the API boundary.
- Python: type hints on public functions, docstrings on modules, snake_case. Small
  pure functions that are easy to test.
- React: functional components and hooks, one component per file. Every panel handles
  loading, error and empty states — never a blank area.
- Errors: log the cause, return a degraded-but-valid response. Silent `except: pass`
  is forbidden; it is how a demo fails on stage with no clue why.

## Key domain numbers

- Delhi: 28.6139 N, 77.2090 E
- Default grid capacity assumption: **9,100 MW** (planning assumption, configurable from
  the UI; derived in `backend/config.py` as record 5-min demand 8,705 MW x 1.05 reserve)
- Observed Delhi peak in our data: 8,705 MW 5-min / 8,653 MW hourly-mean (2026-06-29)
- DISCOMs: BRPL (~40%), BYPL (~20%), TPDDL (~33%), NDMC (~5%), MES (~2%)
- Daily shape: night trough ~03:00–05:00, afternoon AC peak ~14:00–16:00, **second
  evening peak ~22:00–23:00 which is often the daily maximum**

## Data provenance

- **Primary source: REAL Delhi system load**, `data/raw/delhi_load_history.csv`
  (gitignored, never committed). 5-minute SLDC readings, single series
  (`entity = Delhi`), 2023-01-01 00:00 to 2026-09-04 23:10 IST, 374,823 rows.
  Timestamps are naive in the file and are treated as IST.
- **Aggregation: 5-min to hourly by MEAN** into `demand_mw` (the training target).
  The hourly MAX is kept alongside as `demand_max_mw` so the instantaneous-peak
  margin can be exposed later; it is never a feature. Typical margin: the hourly
  max exceeds the hourly mean by ~65 MW on a day's peak hour (p95 ~150 MW).
- **Weather: a supplied hourly file**, `data/raw/delhi_weather_history.csv`
  (2023-01-01 to 2026-09-04, no gaps). Its provenance is **not verified**; it is
  labelled `supplied_file` in `data/processed/delhi_history.provenance.json`
  and must not be presented as Open-Meteo. The Open-Meteo archive path in
  `scripts/fetch_weather_history.py` remains available when no file is supplied.
- **Processed file:** `data/processed/delhi_history.csv` (gitignored), built by
  `python scripts/fetch_weather_history.py --csv data/raw/delhi_load_history.csv
  --weather-csv data/raw/delhi_weather_history.csv --out data/processed/delhi_history.csv`.
  31,494 hourly rows; the loader interpolates 341 gap hours (<= 3 h) and leaves
  397 unfilled (1.2 % missing). Zero outliers flagged.
- **Demo data is a labelled fallback only.** `data/demo/` and the generator stay
  untouched. If `PEAKWATCH_HISTORY_CSV` is unset or unreadable the API falls back
  to simulated history and reports `data_source = "demo"`.
- Teammate files in `data/raw/` (`training_data.csv`, `test_predictions.csv`,
  `demand_model.joblib`) are cross-check/reference only. Never train on, load
  or serve them.

## Current model state (retraining updates these)

Trained on REAL data via
`python scripts/train_model.py --csv data/processed/delhi_history.csv`

- Selected `hist_gradient_boosting` (validation MAE 57.5) over `random_forest` (72.3)
- Chronological split: train 2023-01 to 2025-07, validation 2025-07 to 2026-02,
  **test 2026-02-02 to 2026-09-01** (includes summer 2026)
- Test MAE **69.4 MW** (MAPE 1.4 %) vs same-hour-previous-day baseline **297.9 MW**
  — 76.7 % better. Daily-peak MAE 76.8 MW, peak-hour hit rate 85 %.
- Interval band: P10-P90 of the deployed model's out-of-sample residuals over a
  **rolling 28-day window** (`ml/evaluation/calibration.py`). Measured coverage
  on the test window, rolling rule: **78.2 %** one-step (static validation-split
  scheme gave 75.3 %). Still short of the nominal 80 %; say so.
- **Recursive 24 h band coverage is only 40.3 %** (172 test days; 55 % at lead
  1-6 h falling to 30 % at 19-24 h). The +1 %/hour widening heuristic in
  `ml/inference/predictor.py` is far too small: recursive residuals are 1.7x the
  one-step width at 1-6 h and 4.2x at 19-24 h. Fixing this needs a
  lead-dependent band; not yet done.
- Summer-2025 backtest (model trained only on data before 2025-05-01, tested
  May-Sep 2025): 1-step MAE 69.7 vs baseline 335.8 (79 % better). Recursive
  24 h from 23:00: MAE 223 vs 339, daily-peak MAE 245 vs 320.
- Top drivers: demand 1 h ago (1453), hour of day (79), demand same hour
  yesterday (56), hour sin/cos, temperature (29). Metered history dominates;
  weather matters mainly through the lags.
- Artifact: `ml/models/model.joblib` (`data_source = "real"`), gitignored.

**Known weakness:** the recursive 24 h forecast under-predicts the peak on the
hottest days — on the 10 highest-load summer-2025 days the predicted daily peak
is ~300 MW low. Real data now confirms Delhi's evening peak (~23:00) ties the
afternoon peak (~15:00); the demo generator still lacks it.

## Constraints on this machine

- Windows, Git Bash. Slow, flaky network — avoid adding dependencies, and never add
  one that needs a compiler.
- Backend runs from repo root: `uvicorn backend.main:app --reload`
- Real data swaps in by pointing `PEAKWATCH_HISTORY_CSV` at a cleaned CSV and
  restarting the API. Keep that path working.

## How to work with me

- Prefer **editing existing files** over creating new ones.
- Do not create README or docs files unless asked.
- **Diagnose before changing.** When I report a bug, investigate and report findings
  first; wait for a go-ahead before writing the fix.
- When a change is non-trivial, outline the plan first and wait for confirmation.
- Explain *why* in a sentence for any modelling or design decision — this project must
  be defensible to judges, not merely functional.
- After writing a function, show me how to run or verify it in one command.
- Run `pytest -q` after backend or ml changes and report the result.
