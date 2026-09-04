"""GET /api/weather-impact - temperature/load relationship from the loaded history."""

from fastapi import APIRouter

from backend.services.weather_impact_service import build_weather_impact_response

router = APIRouter(tags=["weather"])


@router.get("/weather-impact")
def get_weather_impact():
    return build_weather_impact_response()
