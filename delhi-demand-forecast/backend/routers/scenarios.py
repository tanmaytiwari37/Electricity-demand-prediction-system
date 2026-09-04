"""POST /api/whatif - temperature and rooftop-solar what-if scenario."""

from fastapi import APIRouter

from backend.models.schemas import WhatIfRequest
from backend.services.whatif_service import build_whatif_response

router = APIRouter(tags=["scenario"])


@router.post("/whatif")
def post_whatif(req: WhatIfRequest):
    return build_whatif_response(req.temp_delta_c, req.rooftop_solar_mw, req.horizon, req.capacity_mw)
