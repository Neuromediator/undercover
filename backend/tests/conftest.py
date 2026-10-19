import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.seed import seed


@pytest.fixture
def client(tmp_path, monkeypatch):
    """A client for the app on a freshly seeded database in a temporary file."""
    path = tmp_path / "test.db"
    monkeypatch.setenv("UNDERCOVER_DB", str(path))
    seed(path)
    return TestClient(app)
