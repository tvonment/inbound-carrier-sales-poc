from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Call
from app.schemas import CallSummary, MetricsOut, Outcome

router = APIRouter()


def _distribution(db: Session, column) -> dict[str, int]:
    rows = db.execute(
        select(column, func.count()).where(column.is_not(None)).group_by(column)
    ).all()
    return {value: count for value, count in rows}


@router.get("/api/metrics", response_model=MetricsOut)
def metrics(db: Session = Depends(get_db)):
    total_calls = db.scalar(select(func.count()).select_from(Call)) or 0
    booked_count = (
        db.scalar(
            select(func.count()).select_from(Call).where(Call.outcome == Outcome.booked.value)
        )
        or 0
    )

    # Average rounds across calls that reached pricing (including 0-round
    # instant-accepts of the listed rate). Calls that never got to a rate have
    # null rounds and are excluded.
    avg_rounds = db.scalar(
        select(func.avg(Call.negotiation_rounds)).where(
            Call.negotiation_rounds.is_not(None)
        )
    )

    # Margin story: average agreed rate vs loadboard rate on booked calls.
    # `> 0` also guards against any stray 0 rate corrupting the average.
    booked_rates = select(Call.final_rate, Call.loadboard_rate).where(
        Call.outcome == Outcome.booked.value,
        Call.final_rate > 0,
        Call.loadboard_rate > 0,
    )
    pairs = db.execute(booked_rates).all()
    avg_final = avg_board = avg_delta = avg_delta_pct = None
    if pairs:
        avg_final = sum(p.final_rate for p in pairs) / len(pairs)
        avg_board = sum(p.loadboard_rate for p in pairs) / len(pairs)
        avg_delta = avg_final - avg_board
        avg_delta_pct = (avg_delta / avg_board) * 100 if avg_board else None

    recent = db.scalars(
        select(Call).order_by(Call.created_at.desc(), Call.id.desc()).limit(10)
    ).all()

    return MetricsOut(
        total_calls=total_calls,
        booked_count=booked_count,
        conversion_rate=round(booked_count / total_calls, 4) if total_calls else 0.0,
        avg_negotiation_rounds=round(avg_rounds, 2) if avg_rounds is not None else None,
        outcome_distribution=_distribution(db, Call.outcome),
        sentiment_distribution=_distribution(db, Call.sentiment),
        avg_final_rate=round(avg_final, 2) if avg_final is not None else None,
        avg_loadboard_rate=round(avg_board, 2) if avg_board is not None else None,
        avg_rate_delta=round(avg_delta, 2) if avg_delta is not None else None,
        avg_rate_delta_pct=round(avg_delta_pct, 2) if avg_delta_pct is not None else None,
        recent_calls=[CallSummary.model_validate(c) for c in recent],
    )
