import pytest
from fastapi.testclient import TestClient

from agent import main
from backend.main import app
from backend.seed import seed


@pytest.fixture(autouse=True)
def database(tmp_path, monkeypatch):
    """Point the agent at the app on a freshly seeded database in a temporary file."""
    path = tmp_path / "test.db"
    monkeypatch.setenv("UNDERCOVER_DB", str(path))
    seed(path)
    monkeypatch.setattr(main, "backend", lambda: TestClient(app))


@pytest.fixture
def client():
    """A client for checking what the agent did to the claims."""
    return TestClient(app)
