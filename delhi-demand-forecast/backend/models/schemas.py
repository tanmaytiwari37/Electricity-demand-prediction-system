"""Request schemas and shared query-parameter helpers.

Responses are plain dicts built by the services (the frontend types in
``frontend/src/types/api.ts`` mirror them). Only request bodies are
validated here so that adding an informative field to a response never
requires touching two places.
"""

from __future__ import annotations

from fastapi import Query
from pydantic import BaseModel, Field

from backend.config import settings


class WhatIfRequest(BaseModel):
    temp_delta_c: float = Field(0.0, ge=-10, le=10, description="Temperature shift applied to the weather forecast, degC")
    rooftop_solar_mw: float = Field(0.0, ge=0, le=5000, description="Installed rooftop solar capacity, MW")
    horizon: int = Field(24, ge=1, le=168, description="Horizon in hours")
    capacity_mw: float | None = Field(None, gt=0, description="Override grid capacity assumption, MW")


def horizon_query(default: int = 24):
    return Query(default, ge=1, le=settings.max_horizon_hours, description="Forecast horizon in hours (max 168)")


def capacity_query():
    return Query(None, gt=0, description="Override the grid-capacity assumption (MW) for this request")
