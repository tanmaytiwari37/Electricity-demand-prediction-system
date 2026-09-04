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
- Default grid capacity assumption: **8,500 MW** (configurable from the UI)
- Historical Delhi peak reference: 8,000+ MW in recent summers
- DISCOMs: BRPL (~40%), BYPL (~20%), TPDDL (~33%), NDMC (~5%), MES (~2%)
- Daily shape: night trough ~03:00–05:00, afternoon AC peak ~14:00–16:00, **second
  evening peak ~22:00–23:00 which is often the daily maximum**

## Current model state (retraining updates these)

Trained via
`python scripts/train_model.py --csv data/demo/demo_history.csv --data-source demo`

- Selected `hist_gradient_boosting` (validation MAE 167.2) over `random_forest` (182.0)
- Test MAE **93.8 MW** vs same-hour-previous-day baseline **333.6 MW** — 71.9% better
- Interval coverage 94.4%
- Top drivers: demand 1h ago (805.6), temperature (218.5), hour-of-day terms,
  cooling degrees above 24 °C
- Artifact: `ml/models/model.joblib`

**Known weakness:** the 24h recursive forecast damps the evening peak — predictions
regress toward the mean as predicted lags feed back in. Treat this as a real defect,
not a quirk.

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
