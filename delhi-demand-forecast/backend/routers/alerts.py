"""GET /api/alerts - capacity-risk alerts derived from the forecast."""

from fastapi import APIRouter

from backend.models.schemas import capacity_query, horizon_query
from backend.services.alert_service import build_alerts_response

router = APIRouter(tags=["alerts"])


@router.get("/alerts")
def get_alerts(horizon: int = horizon_query(24), capacity_mw: float | None = capacity_query()):
    return build_alerts_response(horizon, capacity_mw)
