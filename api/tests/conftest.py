import os
import tempfile

# Must be set before the app (and its settings cache) is imported.
_db_path = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ["API_KEY"] = "test-key"
os.environ["MOCK_FMCSA"] = "true"
os.environ["NEGOTIATION_THRESHOLDS"] = "0.12,0.08,0.04"

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    from app.main import app

    # Context manager runs lifespan: creates tables and seeds loads.
    with TestClient(app) as c:
        c.headers.update({"X-API-Key": "test-key"})
        yield c


@pytest.fixture(scope="session")
def anon_client(client):
    from app.main import app

    return TestClient(app)
