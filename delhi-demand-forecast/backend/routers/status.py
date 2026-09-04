"""GET /api/status and GET /api/model - provenance, freshness and model card."""

from fastapi import APIRouter

from backend.services.status_service import build_status_response, model_card

router = APIRouter(tags=["status"])


@router.get("/status")
def get_status():
    return build_status_response()


@router.get("/model")
def get_model():
    return model_card()
