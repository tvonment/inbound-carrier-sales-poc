from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

JsonCol = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Load(Base):
    __tablename__ = "loads"

    load_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    origin: Mapped[str] = mapped_column(String(100), index=True)
    destination: Mapped[str] = mapped_column(String(100))
    pickup_datetime: Mapped[datetime] = mapped_column(DateTime)
    delivery_datetime: Mapped[datetime] = mapped_column(DateTime)
    equipment_type: Mapped[str] = mapped_column(String(40), index=True)
    loadboard_rate: Mapped[float] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    commodity_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    num_of_pieces: Mapped[int | None] = mapped_column(Integer, nullable=True)
    miles: Mapped[float | None] = mapped_column(Float, nullable=True)
    dimensions: Mapped[str | None] = mapped_column(String(80), nullable=True)

    # Booking state (set by POST /api/book)
    booked: Mapped[bool] = mapped_column(Boolean, default=False)
    booked_by_mc: Mapped[str | None] = mapped_column(String(20), nullable=True)
    agreed_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    confirmation_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    booked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Carrier(Base):
    """Cache of FMCSA verification results."""

    __tablename__ = "carriers"

    mc_number: Mapped[str] = mapped_column(String(20), primary_key=True)
    carrier_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    eligible: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw: Mapped[dict | None] = mapped_column(JsonCol, nullable=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Call(Base):
    """One row per finished call, posted by the platform's post-call webhook."""

    __tablename__ = "calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    mc_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    carrier_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    load_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    outcome: Mapped[str] = mapped_column(String(40), index=True)
    sentiment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    negotiation_rounds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    initial_offer: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    loadboard_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted: Mapped[dict | None] = mapped_column(JsonCol, nullable=True)
