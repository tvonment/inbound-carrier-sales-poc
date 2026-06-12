from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All runtime configuration. Values come from env vars (ACA secrets in Azure)."""

    api_key: str = "dev-secret-key"
    database_url: str = "sqlite:///./local.db"

    # Swagger/redoc reachable without a key. Off by default; enable locally.
    expose_docs: bool = False

    # FMCSA QCMobile API. Mock mode is the default so the demo never depends
    # on an external service being up.
    mock_fmcsa: bool = True
    fmcsa_webkey: str = ""

    # Per-round acceptance thresholds above loadboard rate. Length = max rounds.
    negotiation_thresholds: str = "0.12,0.08,0.04"

    @property
    def thresholds(self) -> list[float]:
        return [float(t) for t in self.negotiation_thresholds.split(",") if t.strip()]

    @property
    def max_rounds(self) -> int:
        return len(self.thresholds)


@lru_cache
def get_settings() -> Settings:
    return Settings()
