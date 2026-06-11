from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Load
from app.schemas import LoadOut, LoadSearchResponse

router = APIRouter()

MAX_RESULTS = 3


def _city_term(value: str) -> str:
    """'Chicago, IL' -> 'chicago'; keeps matching forgiving for voice input."""
    return value.split(",")[0].strip().lower()


def _score(load: Load, origin: str, destination: str | None,
           equipment_type: str | None, pickup_date: date | None) -> float:
    score = 0.0
    if destination and _city_term(destination) in load.destination.lower():
        score += 2
    if equipment_type and equipment_type.strip().lower() == load.equipment_type.lower():
        score += 3
    if pickup_date:
        days_off = abs((load.pickup_datetime.date() - pickup_date).days)
        score += max(0, 2 - days_off)
    # Earlier pickups first as a tie-breaker.
    score -= load.pickup_datetime.timestamp() / 1e10
    return score


@router.get("/api/loads/search", response_model=LoadSearchResponse)
def search_loads(
    origin: str = Query(min_length=2),
    destination: str | None = None,
    equipment_type: str | None = None,
    pickup_date: date | None = None,
    db: Session = Depends(get_db),
):
    term = _city_term(origin)
    stmt = (
        select(Load)
        .where(Load.booked.is_(False))
        .where(Load.origin.ilike(f"%{term}%"))
        .where(Load.pickup_datetime >= datetime.now())
    )
    candidates = db.scalars(stmt).all()

    # Hard-filter on equipment when given; the agent pitches what was asked for.
    if equipment_type:
        eq = equipment_type.strip().lower()
        filtered = [l for l in candidates if l.equipment_type.lower() == eq]
        if filtered:
            candidates = filtered

    ranked = sorted(
        candidates,
        key=lambda l: _score(l, origin, destination, equipment_type, pickup_date),
        reverse=True,
    )[:MAX_RESULTS]

    return LoadSearchResponse(
        results=[LoadOut.model_validate(l) for l in ranked],
        count=len(ranked),
    )
