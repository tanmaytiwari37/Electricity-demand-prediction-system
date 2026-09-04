"""PeakWatch Delhi - FastAPI backend.

Architecture
------------
    React/Vite dashboard (http://localhost:5173)
        |  fetch http://localhost:8000/api/*
        v
    FastAPI app (this file)  ->  backend/routers/*  ->  backend/services/*
                                                              |
                                        +---------------------+---------------------+
                                        v                     v                     v
                                  forecast_service      weather_service        whatif_service
                                  alert_service         (Open-Meteo, cache)    feeder_service
                                        |                                      weather_impact_service
                                        v
                                  ml/ (DemandPredictor, features, training)
                                        |
                                        v
                                  data_store: history CSV (REAL) or demo generator (SIMULATED)

* ``main.py`` only builds the app: CORS for the Vite dev server, one
  ``include_router()`` per feature module under ``/api``, and a startup hook
  that loads the data store once.
* Each router owns one endpoint family and delegates to a service.
* ``backend/config.py`` holds constants, ASSUMPTION parameters and the
  environment-driven ``Settings``.
* ``backend/services/data_store.py`` decides at startup whether the app runs
  on a REAL dataset (``PEAKWATCH_HISTORY_CSV``) or in DEMO MODE, which
  weather source is used, and whether a trained model is available. Every
  response carries ``data_source`` and, where relevant, ``forecast_method``
  so the UI can label provenance honestly.

Run:  uvicorn backend.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import APP_VERSION, settings
from backend.routers import actual, alerts, feeders, forecast, health, scenarios, status, weather_impact
from backend.services.data_store import store

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.load()
    yield


app = FastAPI(
    title="PeakWatch Delhi API",
    description="AI-based electricity demand prediction and peak-risk early warning for Delhi DISCOM/SLDC operations.",
    version=APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api"
for router in (
    health.router,
    status.router,
    forecast.router,
    actual.router,
    alerts.router,
    feeders.router,
    weather_impact.router,
    scenarios.router,
):
    app.include_router(router, prefix=API_PREFIX)


@app.get("/", include_in_schema=False)
def root():
    return {"name": "PeakWatch Delhi API", "version": APP_VERSION, "docs": "/docs"}
