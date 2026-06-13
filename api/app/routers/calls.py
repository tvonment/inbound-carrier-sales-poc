from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Call, Carrier, Load
from app.schemas import CallIn, CallOut
from app.services.fmcsa import normalize_mc

router = APIRouter()


@router.post("/api/calls", response_model=CallOut, status_code=201)
def record_call(body: CallIn, db: Session = Depends(get_db)):
    mc = normalize_mc(body.mc_number) if body.mc_number else None

    # Denormalize for the dashboard: loadboard rate for margin metrics,
    # carrier name for the recent-calls table.
    loadboard_rate = None
    if body.load_id:
        load = db.get(Load, body.load_id)
        loadboard_rate = load.loadboard_rate if load else None

    carrier_name = body.carrier_name
    if not carrier_name and mc:
        carrier = db.get(Carrier, mc)
        carrier_name = carrier.carrier_name if carrier else None

    # A rate of 0 or less means no rate was actually discussed; store null so it
    # never renders as "$0" and never skews the agreed-vs-loadboard average.
    final_rate = body.final_rate if (body.final_rate or 0) > 0 else None
    initial_offer = body.initial_offer if (body.initial_offer or 0) > 0 else None

    call = Call(
        mc_number=mc,
        carrier_name=carrier_name,
        load_id=body.load_id,
        outcome=body.outcome.value,
        sentiment=body.sentiment.value if body.sentiment else None,
        negotiation_rounds=body.negotiation_rounds,
        initial_offer=initial_offer,
        final_rate=final_rate,
        loadboard_rate=loadboard_rate,
        transcript=body.transcript,
        extracted=body.extracted,
    )
    db.add(call)
    db.commit()
    return CallOut.model_validate(call)


@router.get("/api/calls", response_model=list[CallOut])
def list_calls(limit: int = Query(default=20, le=100), db: Session = Depends(get_db)):
    calls = db.scalars(
        select(Call).order_by(Call.created_at.desc(), Call.id.desc()).limit(limit)
    ).all()
    return [CallOut.model_validate(c) for c in calls]
