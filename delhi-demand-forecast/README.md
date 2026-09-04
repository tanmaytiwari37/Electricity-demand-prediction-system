# PeakWatch Delhi

**See tomorrow's peak today.** An AI-powered electricity demand intelligence and early-warning platform for
Delhi DISCOM / SLDC operations.

```
Historical load + weather -> cleaning -> ML forecast -> peak & capacity risk -> area risk -> what-if -> decision support
```

## Data honesty

The app never presents simulated data as real Delhi operational data. Every panel carries a badge:

| Badge | Meaning |
|---|---|
| **REAL HISTORICAL** | operator-supplied CSV loaded via `PEAKWATCH_HISTORY_CSV` |
| **SIMULATED DEMO DATA** | synthetic history from `ml/demo_data.py`, calibrated only to public ranges |
| **MODEL PREDICTION** | output of the trained model (the badge also says what data it was trained on) |
| **HEURISTIC ESTIMATE** | same-hour-last-7-days fallback while no model is loaded |
| **LIVE / CACHED / SIMULATED WEATHER** | Open-Meteo forecast, its cache, or the demo generator |
| **ASSUMPTION** | editable demo parameter (grid capacity 9,200 MW planning assumption, risk thresholds 85/92/97 %) |
| **RULE-BASED ADVICE** | system-generated recommendation, not an operational instruction |

Until the real dataset is provided the app runs entirely in **DEMO MODE**.

## Run locally

Requirements: Python 3.11+, Node 20+. No API keys (Open-Meteo is keyless).

```powershell
# backend (from the repo root)
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000     # http://localhost:8000/docs

# frontend
cd frontend
npm install
npm run dev                                                 # http://localhost:5173
```

Or start both with `.\scripts\dev.ps1`. Copy `.env.example` to `.env` to change settings.

On first start in demo mode the API serves heuristic forecasts immediately and trains a demo model in the
background (about 10-15 s); the header badge switches from HEURISTIC ESTIMATE to MODEL PREDICTION automatically.

## Deployment (bonus - the live demo runs locally)

Two services, deployed separately. Nothing here changes the local path: with no
environment variables set, the backend serves the committed real dataset on port
8000 and the frontend talks to it through the Vite proxy exactly as before.

| Service | Platform | What it needs |
|---|---|---|
| Backend (FastAPI) | Render, free tier, from `render.yaml` | `PORT` (injected by Render), `PEAKWATCH_HISTORY_CSV=data/processed/delhi_history.csv`, `PEAKWATCH_FRONTEND_ORIGIN=https://<your-app>.vercel.app` (CORS), optional `PEAKWATCH_CAPACITY_MW` |
| Frontend (Vite static build) | Vercel, root directory `frontend` | `VITE_API_BASE=https://<your-api>.onrender.com` |

The committed `data/processed/delhi_history.csv` and `ml/models/model.joblib` are all the
backend needs; `data/raw/` and `.env` are gitignored and never deployed.

**Backend on Render**

1. Push the repo to GitHub.
2. Render dashboard -> New -> Blueprint -> select the repo. Render reads `render.yaml`
   (build `pip install -r backend/requirements.txt`, start `python -m backend.main`,
   health check `/api/health`).
3. When prompted, set `PEAKWATCH_FRONTEND_ORIGIN` to the Vercel URL (you can fill it in
   after step 6 and redeploy). Do not use a wildcard origin.
4. Wait for the first deploy, then open `https://<your-api>.onrender.com/api/health` -
   it must return `"data_source": "real"` and `"model_loaded": true`.

**Frontend on Vercel**

5. Vercel dashboard -> Add New Project -> import the repo. Set **Root Directory** to
   `frontend` (framework preset Vite, build `npm run build`, output `dist` are detected).
6. Add the environment variable `VITE_API_BASE=https://<your-api>.onrender.com` and deploy.
   `frontend/vercel.json` rewrites every path to `index.html` so React Router deep links work.
7. Copy the Vercel URL into `PEAKWATCH_FRONTEND_ORIGIN` on Render (step 3) and redeploy the
   API, otherwise browser requests fail CORS.

**Free-tier caveat.** Render free web services sleep after about 15 minutes idle. The
first request after that is a cold start of up to a minute (install is cached; the app
loads the CSV and model in a few seconds once the container is up). The dashboard shows
"Cannot reach the API ... retry shortly" until the API wakes. Open the health URL a
minute before a demo. Never rely on the deployed copy for the live demo - run locally.

## Tests

```powershell
python -m pytest            # 37 API + ML tests (demo mode, no network)
cd frontend; npx tsc -b; npm run build
```

## Project layout

```
backend/     FastAPI: main.py, config.py (constants + Settings), routers/, services/, models/, utils/
ml/          schema, data/loader, features, baseline, training/, evaluation/, inference/, demo_data, models/*.joblib
frontend/    React + Vite + Tailwind + Recharts dashboard (src/pages, components, services/api.ts, hooks, types)
scripts/     inspect_dataset.py, train_model.py, generate_demo_csv.py, fetch_weather_history.py, dev.ps1
tests/       pytest suite
data/        raw/ processed/ demo/ cache/   (real data is never committed)
docs/        ARCHITECTURE.md
```

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | liveness, model status |
| GET | `/api/status` | provenance, freshness, assumptions, model card |
| GET | `/api/model` | metrics, baselines, permutation importance |
| GET | `/api/forecast?horizon=24` | 1-168 h, optional `capacity_mw` |
| GET | `/api/actual?hours=48` | actuals with 1-hour-ahead backtest |
| GET | `/api/alerts?horizon=24` | risk level, headroom, alert windows |
| GET | `/api/feeders?ts=` | DISCOM split and hourly heatmap |
| GET | `/api/weather-impact` | temperature-load statistics |
| POST | `/api/whatif` | `{temp_delta_c, rooftop_solar_mw, horizon, capacity_mw?}` |

## When the real CSV arrives

Do not retrain blindly. The pipeline enforces the checklist:

```powershell
python scripts/inspect_dataset.py data/raw/delhi_load.csv        # schema, timestamps, gaps, units, outliers, coverage, suitability
python scripts/fetch_weather_history.py --csv data/raw/delhi_load.csv --out data/processed/delhi_history.csv   # only if weather columns are missing
python scripts/train_model.py --csv data/processed/delhi_history.csv --out ml/models/model.joblib               # baselines vs candidates, test-set metrics
```

Then set `PEAKWATCH_HISTORY_CSV=data/processed/delhi_history.csv` and restart the API. The loader accepts common
column aliases (`ts`, `load_mw`, `temp`, ...) and requires only `timestamp` and `demand_mw`; optional columns
(temperature, humidity, wind, solar, holiday) are used when present. Demo mode remains the fallback.

## Model

* Features: calendar (hour, weekday, day-of-year, weekend, Indian public holidays), weather (temperature, squared,
  cooling/heating degrees, humidity, wind), lags (1 h, 24 h, 168 h) and rolling means (24 h, 7 d). All lag features
  use only values before the target hour.
* Baselines: same hour yesterday, same hour last week.
* Candidates: scikit-learn HistGradientBoosting and RandomForest, chosen by validation MAE on a chronological split,
  scored once on the untouched test period, then refit on train+validation.
* Prediction band: empirical P10/P90 of validation residuals, widened with lead time.
* Explainability: permutation importance on the test set. Nothing is displayed that was not computed.

## Limitations

* Demo history and the DISCOM/area split are simulated; feeder capacities are not public.
* The demo model learns the demo generator, so its accuracy says nothing about real Delhi load.
* Rooftop solar in the what-if uses a fixed hour-of-day profile; cloud cover is not modelled.
* Alert thresholds and grid capacity are demo assumptions, not SLDC operating limits.
