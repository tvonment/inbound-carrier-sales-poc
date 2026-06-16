from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Call, Load, utcnow
from app.schemas import CallSummary, CarrierStat, DailyStat, LaneStat, MetricsOut, Outcome

router = APIRouter()

LANE_LIMIT = 60
CARRIER_LIMIT = 10


def _scoped(stmt, cutoff: datetime | None):
    """Apply the date-range cutoff to a Call-based statement when one is set."""
    return stmt.where(Call.created_at >= cutoff) if cutoff else stmt


def _distribution(db: Session, column, cutoff: datetime | None) -> dict[str, int]:
    rows = db.execute(
        _scoped(select(column, func.count()).where(column.is_not(None)), cutoff).group_by(
            column
        )
    ).all()
    return {value: count for value, count in rows}


def _daily_calls(db: Session, cutoff: datetime | None) -> list[DailyStat]:
    """Per-day call volume (total + booked). Bucketed in Python on the date part
    of created_at so it behaves the same on SQLite (tests) and Postgres (prod)."""
    rows = db.execute(_scoped(select(Call.created_at, Call.outcome), cutoff)).all()
    buckets: dict[str, dict[str, int]] = {}
    for created_at, outcome in rows:
        day = created_at.date().isoformat()
        bucket = buckets.setdefault(day, {"total": 0, "booked": 0})
        bucket["total"] += 1
        if outcome == Outcome.booked.value:
            bucket["booked"] += 1
    return [
        DailyStat(date=day, total=b["total"], booked=b["booked"])
        for day, b in sorted(buckets.items())
    ]


def _lanes(db: Session, cutoff: datetime | None) -> list[LaneStat]:
    """Activity per origin -> destination lane *and carrier*, joining calls to
    their load. Calls with no matched load (not-eligible / no-match / abandoned)
    drop out. The per-carrier grain lets the dashboard build a carrier filter and
    re-aggregate client-side without a parameterized endpoint."""
    pairs = db.execute(
        _scoped(
            select(
                Load.origin,
                Load.destination,
                Call.mc_number,
                Call.carrier_name,
                Call.outcome,
                Call.final_rate,
            ).join(Load, Call.load_id == Load.load_id),
            cutoff,
        )
    ).all()
    lanes: dict[tuple, dict] = {}
    for origin, destination, mc, carrier, outcome, final_rate in pairs:
        lane = lanes.setdefault(
            (origin, destination, mc, carrier),
            {"calls": 0, "booked": 0, "revenue": 0.0},
        )
        lane["calls"] += 1
        if outcome == Outcome.booked.value:
            lane["booked"] += 1
            if final_rate:
                lane["revenue"] += final_rate
    ranked = sorted(lanes.items(), key=lambda kv: kv[1]["calls"], reverse=True)[
        :LANE_LIMIT
    ]
    return [
        LaneStat(
            origin=origin,
            destination=destination,
            mc_number=mc,
            carrier_name=carrier,
            calls=v["calls"],
            booked=v["booked"],
            revenue=round(v["revenue"], 2) if v["revenue"] else None,
        )
        for (origin, destination, mc, carrier), v in ranked
    ]


def _carriers(db: Session, cutoff: datetime | None) -> list[CarrierStat]:
    """Per-carrier scorecard: how each carrier converts and negotiates. `margin`
    is the avg of loadboard - final on booked calls (positive = booked below
    list = good for the broker), the per-carrier view of the RateCard story."""
    rows = db.execute(
        _scoped(
            select(
                Call.mc_number,
                Call.carrier_name,
                Call.outcome,
                Call.negotiation_rounds,
                Call.final_rate,
                Call.loadboard_rate,
            ).where(Call.mc_number.is_not(None)),
            cutoff,
        )
    ).all()
    carriers: dict[str, dict] = {}
    for mc, name, outcome, rounds, final_rate, board in rows:
        c = carriers.setdefault(
            mc,
            {"name": None, "calls": 0, "booked": 0, "rounds": [], "margins": [], "revenue": 0.0},
        )
        if name:
            c["name"] = name
        c["calls"] += 1
        if rounds is not None:
            c["rounds"].append(rounds)
        if outcome == Outcome.booked.value:
            c["booked"] += 1
            if final_rate:
                c["revenue"] += final_rate
            if (final_rate or 0) > 0 and (board or 0) > 0:
                c["margins"].append(board - final_rate)
    ranked = sorted(
        carriers.items(), key=lambda kv: (kv[1]["booked"], kv[1]["revenue"]), reverse=True
    )[:CARRIER_LIMIT]
    return [
        CarrierStat(
            mc_number=mc,
            carrier_name=c["name"],
            calls=c["calls"],
            booked=c["booked"],
            conversion_rate=round(c["booked"] / c["calls"], 4) if c["calls"] else 0.0,
            avg_rounds=round(sum(c["rounds"]) / len(c["rounds"]), 2) if c["rounds"] else None,
            avg_margin=round(sum(c["margins"]) / len(c["margins"]), 2) if c["margins"] else None,
            revenue=round(c["revenue"], 2) if c["revenue"] else None,
        )
        for mc, c in ranked
    ]


@router.get("/api/metrics", response_model=MetricsOut)
def metrics(
    days: int | None = Query(default=None, ge=1, le=3650),
    db: Session = Depends(get_db),
):
    # `days` scopes the whole dashboard to a recent window; None = all history
    # (keeps the API general — the dashboard opts into a 30-day default itself).
    cutoff = utcnow() - timedelta(days=days) if days else None

    total_calls = db.scalar(_scoped(select(func.count()).select_from(Call), cutoff)) or 0
    booked_count = (
        db.scalar(
            _scoped(
                select(func.count())
                .select_from(Call)
                .where(Call.outcome == Outcome.booked.value),
                cutoff,
            )
        )
        or 0
    )

    # Average rounds across calls that reached pricing (including 0-round
    # instant-accepts of the listed rate). Calls that never got to a rate have
    # null rounds and are excluded.
    avg_rounds = db.scalar(
        _scoped(
            select(func.avg(Call.negotiation_rounds)).where(
                Call.negotiation_rounds.is_not(None)
            ),
            cutoff,
        )
    )

    # Margin story: average agreed rate vs loadboard rate on booked calls.
    # `> 0` also guards against any stray 0 rate corrupting the average.
    booked_rates = _scoped(
        select(Call.final_rate, Call.loadboard_rate).where(
            Call.outcome == Outcome.booked.value,
            Call.final_rate > 0,
            Call.loadboard_rate > 0,
        ),
        cutoff,
    )
    pairs = db.execute(booked_rates).all()
    avg_final = avg_board = avg_delta = avg_delta_pct = None
    total_revenue = total_saved = None
    if pairs:
        avg_final = sum(p.final_rate for p in pairs) / len(pairs)
        avg_board = sum(p.loadboard_rate for p in pairs) / len(pairs)
        avg_delta = avg_final - avg_board
        avg_delta_pct = (avg_delta / avg_board) * 100 if avg_board else None
        # Cumulative dollars: what we booked, and how much we saved vs the
        # loadboard list (positive = booked below list = margin for the broker).
        total_revenue = sum(p.final_rate for p in pairs)
        total_saved = sum(p.loadboard_rate - p.final_rate for p in pairs)

    recent = db.scalars(
        _scoped(select(Call), cutoff).order_by(Call.created_at.desc(), Call.id.desc()).limit(10)
    ).all()

    return MetricsOut(
        total_calls=total_calls,
        booked_count=booked_count,
        conversion_rate=round(booked_count / total_calls, 4) if total_calls else 0.0,
        avg_negotiation_rounds=round(avg_rounds, 2) if avg_rounds is not None else None,
        outcome_distribution=_distribution(db, Call.outcome, cutoff),
        sentiment_distribution=_distribution(db, Call.sentiment, cutoff),
        avg_final_rate=round(avg_final, 2) if avg_final is not None else None,
        avg_loadboard_rate=round(avg_board, 2) if avg_board is not None else None,
        avg_rate_delta=round(avg_delta, 2) if avg_delta is not None else None,
        avg_rate_delta_pct=round(avg_delta_pct, 2) if avg_delta_pct is not None else None,
        total_booked_revenue=round(total_revenue, 2) if total_revenue is not None else None,
        total_margin_saved=round(total_saved, 2) if total_saved is not None else None,
        daily_calls=_daily_calls(db, cutoff),
        lanes=_lanes(db, cutoff),
        carriers=_carriers(db, cutoff),
        recent_calls=[CallSummary.model_validate(c) for c in recent],
    )
