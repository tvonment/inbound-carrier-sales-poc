from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Carrier, utcnow
from app.schemas import VerifyMCRequest, VerifyMCResponse
from app.services import fmcsa

router = APIRouter()

CACHE_TTL = timedelta(hours=24)


@router.post("/api/verify-mc", response_model=VerifyMCResponse)
def verify_mc(body: VerifyMCRequest, db: Session = Depends(get_db)):
    settings = get_settings()
    mc = fmcsa.normalize_mc(body.mc_number) or body.mc_number

    cached = db.get(Carrier, mc)
    if cached and utcnow() - cached.verified_at < CACHE_TTL:
        return VerifyMCResponse(
            mc_number=mc,
            eligible=cached.eligible,
            carrier_name=cached.carrier_name,
            status=cached.status,
            reason=cached.reason,
        )

    result = fmcsa.verify_mc(
        body.mc_number, mock=settings.mock_fmcsa, webkey=settings.fmcsa_webkey
    )

    # Don't cache transient lookup failures.
    if result.status != "LOOKUP_FAILED":
        carrier = cached or Carrier(mc_number=mc)
        carrier.carrier_name = result.carrier_name
        carrier.eligible = result.eligible
        carrier.status = result.status
        carrier.reason = result.reason
        carrier.raw = result.raw
        carrier.verified_at = utcnow()
        db.add(carrier)
        db.commit()

    return VerifyMCResponse(
        mc_number=mc,
        eligible=result.eligible,
        carrier_name=result.carrier_name,
        status=result.status,
        reason=result.reason,
    )
