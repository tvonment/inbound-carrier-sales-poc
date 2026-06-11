"""FMCSA QCMobile carrier verification, with a deterministic mock fallback.

Mock mode (MOCK_FMCSA=true, the default) keeps the demo independent of the
real API: any well-formed MC number is eligible, except numbers ending in
"999" (not authorized) and "000" (inactive) so failure paths stay demoable.
"""

import re
from dataclasses import dataclass, field

import httpx

FMCSA_BASE_URL = "https://mobile.fmcsa.dot.gov/qc/services"


@dataclass
class VerificationResult:
    mc_number: str
    eligible: bool
    carrier_name: str | None = None
    status: str | None = None
    reason: str | None = None
    raw: dict = field(default_factory=dict)


def normalize_mc(mc_number: str) -> str:
    """'MC-123456' / 'mc 123456' / '123456' -> '123456'."""
    return re.sub(r"\D", "", mc_number)


_MOCK_NAMES = {
    "123456": "Sunrise Freight LLC",
    "234567": "BlueLine Transport Inc",
    "345678": "Prairie Haul Co",
}


def _verify_mock(mc: str) -> VerificationResult:
    if not 4 <= len(mc) <= 8:
        return VerificationResult(
            mc_number=mc, eligible=False, status="NOT_FOUND",
            reason="MC number not found in FMCSA records.",
        )
    if mc.endswith("999"):
        return VerificationResult(
            mc_number=mc, eligible=False, status="NOT_AUTHORIZED",
            carrier_name=f"Carrier {mc}",
            reason="Carrier is not authorized to operate.",
        )
    if mc.endswith("000"):
        return VerificationResult(
            mc_number=mc, eligible=False, status="INACTIVE",
            carrier_name=f"Carrier {mc}",
            reason="Carrier operating status is inactive.",
        )
    return VerificationResult(
        mc_number=mc, eligible=True, status="ACTIVE",
        carrier_name=_MOCK_NAMES.get(mc, f"Carrier {mc} Trucking"),
        reason="Carrier is authorized and active.",
    )


def _verify_real(mc: str, webkey: str) -> VerificationResult:
    url = f"{FMCSA_BASE_URL}/carriers/docket-number/{mc}"
    try:
        resp = httpx.get(url, params={"webKey": webkey}, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        return VerificationResult(
            mc_number=mc, eligible=False, status="LOOKUP_FAILED",
            reason="Could not reach FMCSA verification service.",
        )

    content = data.get("content") or []
    if not content:
        return VerificationResult(
            mc_number=mc, eligible=False, status="NOT_FOUND",
            reason="MC number not found in FMCSA records.", raw=data,
        )

    carrier = content[0].get("carrier") or {}
    allowed = carrier.get("allowedToOperate") == "Y"
    status_code = carrier.get("statusCode")
    active = status_code == "A"
    name = carrier.get("legalName") or carrier.get("dbaName")

    if allowed and active:
        return VerificationResult(
            mc_number=mc, eligible=True, status="ACTIVE", carrier_name=name,
            reason="Carrier is authorized and active.", raw=carrier,
        )
    reason = (
        "Carrier is not authorized to operate."
        if not allowed else "Carrier operating status is not active."
    )
    return VerificationResult(
        mc_number=mc, eligible=False,
        status="NOT_AUTHORIZED" if not allowed else "INACTIVE",
        carrier_name=name, reason=reason, raw=carrier,
    )


def verify_mc(mc_number: str, *, mock: bool, webkey: str = "") -> VerificationResult:
    mc = normalize_mc(mc_number)
    if not mc:
        return VerificationResult(
            mc_number=mc_number, eligible=False, status="INVALID",
            reason="MC number must contain digits.",
        )
    if mock or not webkey:
        return _verify_mock(mc)
    return _verify_real(mc, webkey)
