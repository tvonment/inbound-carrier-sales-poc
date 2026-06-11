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


class CallOut(CallIn):
    id: int
    created_at: datetime
    loadboard_rate: float | None = None

    model_config = {"from_attributes": True}


# --- metrics ---

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
    recent_calls: list[CallOut]
