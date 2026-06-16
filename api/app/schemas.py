from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Outcome(str, Enum):
    booked = "booked"
    negotiation_failed = "negotiation_failed"
    no_matching_load = "no_matching_load"
    carrier_not_eligible = "carrier_not_eligible"
    abandoned = "abandoned"


class Sentiment(str, Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class Decision(str, Enum):
    accept = "accept"
    counter = "counter"
    reject = "reject"


# --- verify-mc ---

class VerifyMCRequest(BaseModel):
    mc_number: str = Field(min_length=1, max_length=20)


class VerifyMCResponse(BaseModel):
    mc_number: str
    eligible: bool
    carrier_name: str | None = None
    status: str | None = None
    reason: str | None = None


# --- loads ---

class LoadOut(BaseModel):
    load_id: str
    origin: str
    destination: str
    pickup_datetime: datetime
    delivery_datetime: datetime
    equipment_type: str
    loadboard_rate: float
    notes: str | None = None
    weight: float | None = None
    commodity_type: str | None = None
    num_of_pieces: int | None = None
    miles: float | None = None
    dimensions: str | None = None

    model_config = {"from_attributes": True}


class LoadSearchResponse(BaseModel):
    results: list[LoadOut]
    count: int


# --- evaluate-offer ---

class EvaluateOfferRequest(BaseModel):
    load_id: str
    offer_amount: float = Field(gt=0)
    round_number: int = Field(ge=1, default=1)


class EvaluateOfferResponse(BaseModel):
    decision: Decision
    counter_amount: float | None = None
    reason: str
    round_number: int
    max_rounds: int


# --- book ---

class BookRequest(BaseModel):
    load_id: str
    mc_number: str
    agreed_rate: float = Field(gt=0)


class BookResponse(BaseModel):
    confirmation_id: str
    load_id: str
    agreed_rate: float
    message: str


# --- calls (metrics ingestion) ---

class CallIn(BaseModel):
    outcome: Outcome
    mc_number: str | None = None
    carrier_name: str | None = None
    load_id: str | None = None
    sentiment: Sentiment | None = None
    negotiation_rounds: int | None = None
    initial_offer: float | None = None
    final_rate: float | None = None
    transcript: str | None = None
    extracted: dict | None = None


class CallSummary(BaseModel):
    """Call row without transcript/extracted — what the dashboard needs.
    The dashboard is publicly viewable, so transcripts stay out of it."""

    id: int
    created_at: datetime
    outcome: Outcome
    mc_number: str | None = None
    carrier_name: str | None = None
    load_id: str | None = None
    sentiment: Sentiment | None = None
    negotiation_rounds: int | None = None
    initial_offer: float | None = None
    final_rate: float | None = None
    loadboard_rate: float | None = None

    model_config = {"from_attributes": True}


class CallOut(CallSummary):
    transcript: str | None = None
    extracted: dict | None = None


# --- metrics ---

class DailyStat(BaseModel):
    """One calendar day of call volume, for the calls-over-time trend."""

    date: str  # ISO date (YYYY-MM-DD)
    total: int
    booked: int


class LaneStat(BaseModel):
    """Aggregated activity for one origin -> destination lane, broken out per
    carrier so the dashboard can filter the map by MC / carrier client-side."""

    origin: str
    destination: str
    mc_number: str | None = None
    carrier_name: str | None = None
    calls: int
    booked: int
    revenue: float | None = None  # sum of agreed rates on booked calls


class CarrierStat(BaseModel):
    """Per-carrier scorecard row: volume, conversion, and negotiation quality."""

    mc_number: str
    carrier_name: str | None = None
    calls: int
    booked: int
    conversion_rate: float
    avg_rounds: float | None = None
    avg_margin: float | None = None  # avg (loadboard - final) on booked; + = below list
    revenue: float | None = None


class MetricsOut(BaseModel):
    total_calls: int
    booked_count: int
    conversion_rate: float
    avg_negotiation_rounds: float | None
    outcome_distribution: dict[str, int]
    sentiment_distribution: dict[str, int]
    avg_final_rate: float | None
    avg_loadboard_rate: float | None
    avg_rate_delta: float | None
    avg_rate_delta_pct: float | None
    total_booked_revenue: float | None
    total_margin_saved: float | None
    daily_calls: list[DailyStat]
    lanes: list[LaneStat]
    carriers: list[CarrierStat]
    recent_calls: list[CallSummary]
