"""GET /api/actual?hours=48 - recent actual load versus 1-hour-ahead backtest."""

from fastapi import APIRouter, Query

from backend.services.actual_service import build_actual_response

router = APIRouter(tags=["actual"])


@router.get("/actual")
def get_actual(hours: int = Query(48, ge=1, le=24 * 30, description="Look-back window in hours")):
    return build_actual_response(hours)
