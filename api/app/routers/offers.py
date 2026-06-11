import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Load, utcnow
from app.schemas import (
    BookRequest,
    BookResponse,
    EvaluateOfferRequest,
    EvaluateOfferResponse,
)
from app.services.fmcsa import normalize_mc
from app.services.negotiation import evaluate_offer

router = APIRouter()


def _get_load(db: Session, load_id: str) -> Load:
    load = db.get(Load, load_id)
    if load is None:
        raise HTTPException(status_code=404, detail=f"Load {load_id} not found")
    return load


@router.post("/api/evaluate-offer", response_model=EvaluateOfferResponse)
def evaluate(body: EvaluateOfferRequest, db: Session = Depends(get_db)):
    settings = get_settings()
    load = _get_load(db, body.load_id)
    if load.booked:
        raise HTTPException(status_code=409, detail=f"Load {load.load_id} is already booked")

    result = evaluate_offer(
        loadboard_rate=load.loadboard_rate,
        offer_amount=body.offer_amount,
        round_number=body.round_number,
        thresholds=settings.thresholds,
    )
    return EvaluateOfferResponse(
        decision=result.decision,
        counter_amount=result.counter_amount,
        reason=result.reason,
        round_number=body.round_number,
        max_rounds=settings.max_rounds,
    )


@router.post("/api/book", response_model=BookResponse)
def book(body: BookRequest, db: Session = Depends(get_db)):
    load = _get_load(db, body.load_id)
    if load.booked:
        raise HTTPException(status_code=409, detail=f"Load {load.load_id} is already booked")

    load.booked = True
    load.booked_by_mc = normalize_mc(body.mc_number) or body.mc_number
    load.agreed_rate = body.agreed_rate
    load.confirmation_id = f"ACME-{uuid.uuid4().hex[:8].upper()}"
    load.booked_at = utcnow()
    db.commit()

    return BookResponse(
        confirmation_id=load.confirmation_id,
        load_id=load.load_id,
        agreed_rate=load.agreed_rate,
        message=(
            f"Load {load.load_id} booked at ${load.agreed_rate:,.0f}. "
            f"Confirmation {load.confirmation_id}."
        ),
    )
