"""GET /api/health - liveness check."""

from fastapi import APIRouter

from backend.config import APP_VERSION
from backend.services.data_store import store

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": store.predictor is not None,
        "model_status": store.model_status,
        "data_source": store.history_source,
        "weather_source": store.weather_source,
        "version": APP_VERSION,
    }
