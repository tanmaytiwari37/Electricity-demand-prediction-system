"""GET /api/feeders?ts=... - per-DISCOM area load and utilisation (SIMULATED split)."""

from fastapi import APIRouter, HTTPException, Query

from backend.models.schemas import capacity_query, horizon_query
from backend.services.feeder_service import build_feeders_response

router = APIRouter(tags=["feeders"])


@router.get("/feeders")
def get_feeders(
    ts: str | None = Query(None, description="ISO 8601 hour to evaluate; defaults to the forecast peak hour"),
    horizon: int = horizon_query(24),
    capacity_mw: float | None = capacity_query(),
):
    try:
        return build_feeders_response(ts, horizon, capacity_mw)
    except ValueError:
        raise HTTPException(status_code=422, detail="ts must be an ISO 8601 timestamp")
