from app.schemas import Decision
from app.services.negotiation import evaluate_offer

THRESHOLDS = [0.12, 0.08, 0.04]
RATE = 2000.0  # ceilings: 2240 / 2160 / 2080


def test_accepts_offer_below_loadboard_rate():
    result = evaluate_offer(RATE, 1900, 1, THRESHOLDS)
    assert result.decision == Decision.accept


def test_accepts_offer_at_round1_ceiling():
    result = evaluate_offer(RATE, 2240, 1, THRESHOLDS)
    assert result.decision == Decision.accept


def test_counters_above_round1_ceiling():
    result = evaluate_offer(RATE, 2500, 1, THRESHOLDS)
    assert result.decision == Decision.counter
    assert result.counter_amount == 2240
    assert result.counter_amount <= RATE * 1.12


def test_threshold_shrinks_per_round():
    # 2200 clears the 12% ceiling but not the 8% one.
    assert evaluate_offer(RATE, 2200, 1, THRESHOLDS).decision == Decision.accept
    round2 = evaluate_offer(RATE, 2200, 2, THRESHOLDS)
    assert round2.decision == Decision.counter
    assert round2.counter_amount == 2160


def test_final_round_rejects_instead_of_countering():
    result = evaluate_offer(RATE, 2200, 3, THRESHOLDS)
    assert result.decision == Decision.reject
    assert result.counter_amount is None


def test_final_round_can_still_accept():
    assert evaluate_offer(RATE, 2080, 3, THRESHOLDS).decision == Decision.accept


def test_rejects_past_max_rounds():
    result = evaluate_offer(RATE, 1500, 4, THRESHOLDS)
    assert result.decision == Decision.reject


def test_counter_is_rounded_to_5():
    # rate 2111 -> ceiling 2364.32 -> counter 2360
    result = evaluate_offer(2111, 3000, 1, THRESHOLDS)
    assert result.decision == Decision.counter
    assert result.counter_amount == 2360
    assert result.counter_amount % 5 == 0
