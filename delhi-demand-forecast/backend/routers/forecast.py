"""GET /api/forecast?horizon=24 - hourly demand forecast with prediction band."""

from fastapi import APIRouter

from backend.models.schemas import capacity_query, horizon_query
from backend.services.forecast_service import build_forecast_response

router = APIRouter(tags=["forecast"])


@router.get("/forecast")
def get_forecast(horizon: int = horizon_query(24), capacity_mw: float | None = capacity_query()):
    return build_forecast_response(horizon, capacity_mw)
