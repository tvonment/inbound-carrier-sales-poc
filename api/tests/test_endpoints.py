"""Endpoint smoke tests against the seeded test database.

Seed facts used here: L-1001 (Chicago Dry Van, $2150), L-2001 (Dallas Dry
Van), Chicago has 5+ unbooked Dry Van loads. Mock FMCSA: *999 = not
authorized, *000 = inactive, anything else eligible.
"""


# --- auth ---

def test_healthz_needs_no_key(anon_client):
    assert anon_client.get("/healthz").status_code == 200


def test_endpoints_reject_missing_key(anon_client):
    resp = anon_client.get("/api/loads/search", params={"origin": "Chicago"})
    assert resp.status_code == 401


def test_endpoints_reject_wrong_key(client):
    resp = client.get(
        "/api/loads/search", params={"origin": "Chicago"},
        headers={"X-API-Key": "wrong"},
    )
    assert resp.status_code == 401


def test_docs_need_key_unless_exposed(anon_client):
    # EXPOSE_DOCS is unset in tests, matching the deployed configuration.
    assert anon_client.get("/docs").status_code == 401
    assert anon_client.get("/openapi.json").status_code == 401


# --- verify-mc ---

def test_verify_mc_eligible(client):
    resp = client.post("/api/verify-mc", json={"mc_number": "MC-123456"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["eligible"] is True
    assert body["mc_number"] == "123456"
    assert body["carrier_name"]


def test_verify_mc_not_authorized(client):
    body = client.post("/api/verify-mc", json={"mc_number": "111999"}).json()
    assert body["eligible"] is False
    assert body["status"] == "NOT_AUTHORIZED"


def test_verify_mc_invalid_input(client):
    body = client.post("/api/verify-mc", json={"mc_number": "abc"}).json()
    assert body["eligible"] is False


# --- load search ---

def test_search_chicago_dry_van(client):
    resp = client.get(
        "/api/loads/search",
        params={"origin": "Chicago", "equipment_type": "Dry Van"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert 1 <= body["count"] <= 3
    for load in body["results"]:
        assert "Chicago" in load["origin"]
        assert load["equipment_type"] == "Dry Van"


def test_search_is_case_insensitive_and_fuzzy(client):
    body = client.get("/api/loads/search", params={"origin": "chicago, il"}).json()
    assert body["count"] >= 1


def test_search_unknown_city_returns_empty(client):
    body = client.get("/api/loads/search", params={"origin": "Zurich"}).json()
    assert body["count"] == 0
    assert body["results"] == []


# --- evaluate-offer ---

def test_evaluate_offer_accept(client):
    resp = client.post(
        "/api/evaluate-offer",
        json={"load_id": "L-1001", "offer_amount": 2000, "round_number": 1},
    )
    assert resp.status_code == 200
    assert resp.json()["decision"] == "accept"


def test_evaluate_offer_counter(client):
    body = client.post(
        "/api/evaluate-offer",
        json={"load_id": "L-1001", "offer_amount": 2600, "round_number": 1},
    ).json()
    assert body["decision"] == "counter"
    assert body["counter_amount"] <= 2150 * 1.12
    assert body["max_rounds"] == 3


def test_evaluate_offer_reject_in_final_round(client):
    body = client.post(
        "/api/evaluate-offer",
        json={"load_id": "L-1001", "offer_amount": 2600, "round_number": 3},
    ).json()
    assert body["decision"] == "reject"


def test_evaluate_offer_unknown_load(client):
    resp = client.post(
        "/api/evaluate-offer",
        json={"load_id": "L-9999", "offer_amount": 2000, "round_number": 1},
    )
    assert resp.status_code == 404


# --- book ---

def test_book_load_and_conflict_on_rebook(client):
    resp = client.post(
        "/api/book",
        json={"load_id": "L-2001", "mc_number": "123456", "agreed_rate": 2050},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["confirmation_id"].startswith("ACME-")
    assert body["agreed_rate"] == 2050

    again = client.post(
        "/api/book",
        json={"load_id": "L-2001", "mc_number": "234567", "agreed_rate": 2100},
    )
    assert again.status_code == 409


def test_booked_load_excluded_from_search(client):
    body = client.get("/api/loads/search", params={"origin": "Dallas"}).json()
    assert all(load["load_id"] != "L-2001" for load in body["results"])


def test_evaluate_offer_on_booked_load_conflicts(client):
    resp = client.post(
        "/api/evaluate-offer",
        json={"load_id": "L-2001", "offer_amount": 2000, "round_number": 1},
    )
    assert resp.status_code == 409


# --- calls + metrics ---

def test_record_booked_call(client):
    resp = client.post(
        "/api/calls",
        json={
            "outcome": "booked",
            "mc_number": "MC-123456",
            "load_id": "L-1001",
            "sentiment": "positive",
            "negotiation_rounds": 2,
            "initial_offer": 2600,
            "final_rate": 2300,
            "transcript": "carrier: ... agent: ...",
            "extracted": {"agreed": True},
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["mc_number"] == "123456"
    assert body["loadboard_rate"] == 2150  # denormalized from the load


def test_record_abandoned_call_with_minimal_payload(client):
    resp = client.post("/api/calls", json={"outcome": "abandoned"})
    assert resp.status_code == 201


def test_record_call_rejects_unknown_outcome(client):
    resp = client.post("/api/calls", json={"outcome": "exploded"})
    assert resp.status_code == 422


def test_list_calls(client):
    body = client.get("/api/calls").json()
    assert len(body) >= 2


def test_metrics(client):
    body = client.get("/api/metrics").json()
    assert body["total_calls"] == 2
    assert body["booked_count"] == 1
    assert body["conversion_rate"] == 0.5
    assert body["outcome_distribution"] == {"booked": 1, "abandoned": 1}
    assert body["sentiment_distribution"] == {"positive": 1}
    assert body["avg_rate_delta"] == 2300 - 2150
    # Cumulative money: one booked call at 2300 vs list 2150.
    assert body["total_booked_revenue"] == 2300
    assert body["total_margin_saved"] == 2150 - 2300
    # Both calls landed today → a single daily bucket: 2 total, 1 booked.
    assert len(body["daily_calls"]) == 1
    assert body["daily_calls"][0]["total"] == 2
    assert body["daily_calls"][0]["booked"] == 1
    # Only the booked call had a load (L-1001 = Chicago -> Dallas); the
    # abandoned call has no load_id and never reaches the lane view.
    assert body["lanes"] == [
        {
            "origin": "Chicago, IL",
            "destination": "Dallas, TX",
            "mc_number": "123456",
            "carrier_name": "Sunrise Freight LLC",
            "calls": 1,
            "booked": 1,
            "revenue": 2300,
        }
    ]
    assert len(body["recent_calls"]) == 2
    # The dashboard is publicly viewable; transcripts must not leak into it.
    assert "transcript" not in body["recent_calls"][0]
    assert "extracted" not in body["recent_calls"][0]


def test_zero_rate_call_is_stored_as_null(client):
    resp = client.post(
        "/api/calls",
        json={
            "outcome": "booked",
            "mc_number": "MC-123456",
            "load_id": "L-1001",
            "negotiation_rounds": 0,
            "initial_offer": 0,
            "final_rate": 0,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    # 0 means no rate was actually agreed → persisted as null, not 0.
    assert body["final_rate"] is None
    assert body["initial_offer"] is None
    # A genuine 0-round accept is a real value and is kept.
    assert body["negotiation_rounds"] == 0


def test_zero_rate_does_not_skew_metrics(client):
    body = client.get("/api/metrics").json()
    # The $0 booked call from the previous test is excluded from the margin,
    # so the only booked rate that counts is still 2300 vs loadboard 2150.
    assert body["avg_final_rate"] == 2300
    assert body["avg_rate_delta"] == 2300 - 2150
    # Rounds average includes the 0-round accept: avg of {2, 0} == 1.0.
    assert body["avg_negotiation_rounds"] == 1.0


def test_non_priced_call_nulls_negotiation_rounds(client):
    # The extract emits 0 (never null) for unknown numerics, so a call that never
    # reached pricing arrives with negotiation_rounds=0. Only booked /
    # negotiation_failed actually negotiate, so the rest are stored as null and
    # stay out of the average.
    resp = client.post(
        "/api/calls",
        json={"outcome": "carrier_not_eligible", "mc_number": "111999", "negotiation_rounds": 0},
    )
    assert resp.status_code == 201
    assert resp.json()["negotiation_rounds"] is None


def test_carrier_breakdown(client):
    # Two booked loads for one carrier (L-1001 board 2150, L-1002 board 1900) and
    # a non-booked call for another, with unmistakable MC numbers.
    for load_id, rate, rounds in [("L-1001", 2000, 2), ("L-1002", 1800, 1)]:
        client.post(
            "/api/calls",
            json={
                "outcome": "booked",
                "mc_number": "MC-700001",
                "carrier_name": "Acme Haulers",
                "load_id": load_id,
                "negotiation_rounds": rounds,
                "final_rate": rate,
            },
        )
    client.post(
        "/api/calls",
        json={"outcome": "no_matching_load", "mc_number": "MC-700002", "carrier_name": "Bravo Freight"},
    )

    by_mc = {c["mc_number"]: c for c in client.get("/api/metrics").json()["carriers"]}
    acme = by_mc["700001"]
    assert acme["carrier_name"] == "Acme Haulers"
    assert acme["calls"] == 2 and acme["booked"] == 2
    assert acme["conversion_rate"] == 1.0
    assert acme["revenue"] == 2000 + 1800
    # Margin = avg(loadboard - final): (2150-2000 + 1900-1800) / 2 == 125.
    assert acme["avg_margin"] == 125
    assert acme["avg_rounds"] == 1.5

    bravo = by_mc["700002"]
    assert bravo["calls"] == 1 and bravo["booked"] == 0
    assert bravo["conversion_rate"] == 0.0
    assert bravo["avg_margin"] is None and bravo["revenue"] is None


def test_days_filter_scopes_window(client):
    # Insert a call dated well outside any preset window, straight to the DB.
    from datetime import timedelta

    from app.db import SessionLocal
    from app.models import Call, utcnow

    with SessionLocal() as s:
        old = Call(
            outcome="booked",
            mc_number="999000",
            created_at=utcnow() - timedelta(days=40),
        )
        s.add(old)
        s.commit()

    unscoped = client.get("/api/metrics").json()
    scoped = client.get("/api/metrics?days=7").json()
    # Every other call was created during this test run, so the 7-day window
    # excludes exactly the 40-day-old row.
    assert unscoped["total_calls"] == scoped["total_calls"] + 1
    assert sum(d["total"] for d in scoped["daily_calls"]) == scoped["total_calls"]


def test_days_filter_rejects_out_of_range(client):
    assert client.get("/api/metrics?days=0").status_code == 422
    assert client.get("/api/metrics?days=99999").status_code == 422
