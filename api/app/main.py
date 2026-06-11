import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import Base, SessionLocal, engine
from app.routers import calls, loads, metrics, offers, verify
from app.seed.seeder import seed_loads

logger = logging.getLogger(__name__)

# Paths reachable without an API key. Docs stay open on purpose: this is a
# PoC and a browsable API surface is part of the demo.
PUBLIC_PATHS = {"/healthz", "/docs", "/openapi.json", "/redoc"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seeded = seed_loads(db)
        if seeded:
            logger.info("Startup seed inserted %d loads", seeded)
    yield


app = FastAPI(
    title="Acme Logistics - Inbound Carrier Sales API",
    version="0.1.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    # Defense in depth behind APIM: the container's own FQDN is reachable,
    # so the app validates X-API-Key itself instead of trusting the gateway.
    if request.url.path not in PUBLIC_PATHS and request.method != "OPTIONS":
        if request.headers.get("X-API-Key") != get_settings().api_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid X-API-Key header"},
            )
    return await call_next(request)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


app.include_router(verify.router, tags=["carriers"])
app.include_router(loads.router, tags=["loads"])
app.include_router(offers.router, tags=["negotiation"])
app.include_router(calls.router, tags=["calls"])
app.include_router(metrics.router, tags=["metrics"])
