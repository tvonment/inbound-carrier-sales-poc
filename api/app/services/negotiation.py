"""Deterministic negotiation policy.

The voice agent orchestrates the conversation; this module decides.
Per round we accept any offer up to loadboard_rate * (1 + threshold).
Thresholds shrink each round, so our ceiling tightens as rounds go on.
Past the final round every offer is rejected.
"""

from dataclasses import dataclass

from app.schemas import Decision


@dataclass
class OfferEvaluation:
    decision: Decision
    counter_amount: float | None
    reason: str


def _round_to_5(amount: float) -> float:
    """Round down to a $5 step so counters sound natural on a voice channel."""
    return float(int(amount / 5) * 5)


def evaluate_offer(
    loadboard_rate: float,
    offer_amount: float,
    round_number: int,
    thresholds: list[float],
) -> OfferEvaluation:
    max_rounds = len(thresholds)

    if round_number > max_rounds:
        return OfferEvaluation(
            decision=Decision.reject,
            counter_amount=None,
            reason=f"Negotiation limit of {max_rounds} rounds reached.",
        )

    threshold = thresholds[max(round_number, 1) - 1]
    ceiling = loadboard_rate * (1 + threshold)

    if offer_amount <= ceiling:
        return OfferEvaluation(
            decision=Decision.accept,
            counter_amount=None,
            reason=f"Offer ${offer_amount:,.0f} is within our limit for this load.",
        )

    if round_number >= max_rounds:
        return OfferEvaluation(
            decision=Decision.reject,
            counter_amount=None,
            reason=(
                f"Offer ${offer_amount:,.0f} is above our final limit of "
                f"${ceiling:,.0f} and no rounds remain."
            ),
        )

    counter = _round_to_5(ceiling)
    return OfferEvaluation(
        decision=Decision.counter,
        counter_amount=counter,
        reason=(
            f"Offer ${offer_amount:,.0f} is above our limit this round; "
            f"we can do ${counter:,.0f}."
        ),
    )
