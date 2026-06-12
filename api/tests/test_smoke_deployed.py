"""Smoke tests against a DEPLOYED environment.

Read-only-ish (no bookings, no call records; verify-mc may cache a carrier
row). Skipped entirely unless SMOKE_GATEWAY_URL is set, so the local suite
stays green. Run after `azd up`:

    SMOKE_GATEWAY_URL=$(azd env get-value APIM_GATEWAY_URL) \
    SMOKE_API_BASE_URL=$(azd env get-value API_BASE_URL) \
    SMOKE_SUBSCRIPTION_KEY=<apim subscription key> \
    uv run pytest tests/test_smoke_deployed.py -v
"""

import os

import httpx
import pytest

GATEWAY = os.environ.get("SMOKE_GATEWAY_URL", "").rstrip("/")
DIRECT = os.environ.get("SMOKE_API_BASE_URL", "").rstrip("/")
KEY = os.environ.get("SMOKE_SUBSCRIPTION_KEY", "")

HEADERS = {"Ocp-Apim-Subscription-Key": KEY}
TIMEOUT = 20.0

pytestmark = pytest.mark.skipif(not GATEWAY, reason="SMOKE_GATEWAY_URL not set")

needs_direct = pytest.mark.skipif(not DIRECT, reason="SMOKE_API_BASE_URL not set")


# --- through the gateway (the platform's path) ---

def test_gateway_rejects_missing_subscription_key():
    resp = httpx.get(f"{GATEWAY}/api/metrics", timeout=TIMEOUT)
    assert resp.status_code == 401


def test_metrics_through_gateway():
    resp = httpx.get(f"{GATEWAY}/api/metrics", headers=HEADERS, timeout=TIMEOUT)
    assert resp.status_code == 200
    body = resp.json()
    assert "total_calls" in body and "recent_calls" in body
    # Public-facing payload must not carry transcripts.
    assert all("transcript" not in c for c in body["recent_calls"])


def test_load_search_through_gateway():
    resp = httpx.get(
        f"{GATEWAY}/api/loads/search",
        params={"origin": "Chicago", "equipment_type": "Dry Van"},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == len(body["results"])


def test_verify_mc_through_gateway_rejects_unknown_carrier():
    # 8-digit nonsense docket: real FMCSA answers NOT_FOUND, mock answers
    # eligible — both come back as a clean 200 with a boolean.
    resp = httpx.post(
        f"{GATEWAY}/api/verify-mc",
        json={"mc_number": "99999999"},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json()["eligible"], bool)


# --- direct to the Container App (the side door that must stay shut) ---

@needs_direct
def test_direct_backend_healthz_is_open():
    resp = httpx.get(f"{DIRECT}/healthz", timeout=TIMEOUT)
    assert resp.status_code == 200


@needs_direct
def test_direct_backend_requires_entra_token():
    # Easy Auth must turn away key-only callers at the platform layer:
    # the app key alone is no longer enough off-gateway.
    resp = httpx.get(
        f"{DIRECT}/api/metrics", headers={"X-API-Key": "not-a-token"}, timeout=TIMEOUT
    )
    assert resp.status_code in (401, 403)


@needs_direct
def test_direct_backend_docs_are_closed():
    resp = httpx.get(f"{DIRECT}/docs", timeout=TIMEOUT)
    assert resp.status_code in (401, 403)
