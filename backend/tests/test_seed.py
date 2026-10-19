import sqlite3
from contextlib import closing

from fastapi.testclient import TestClient

from backend.main import app
from backend.seed import main, seed

COUNTS = {"claims": 25, "policies": 50, "customers": 49, "plans": 3, "handlers": 3}


def test_seed_counts(tmp_path):
    assert seed(tmp_path / "a.db") == COUNTS


def test_seed_again_rebuilds(tmp_path):
    path = tmp_path / "a.db"
    seed(path)
    with closing(sqlite3.connect(path)) as conn, conn:
        conn.execute("UPDATE claims SET status = 'decided'")
    assert seed(path) == COUNTS
    with closing(sqlite3.connect(path)) as conn:
        statuses = conn.execute("SELECT DISTINCT status FROM claims").fetchall()
    assert statuses == [("waiting",)]


def test_customers_keep_only_name_and_history(tmp_path):
    path = tmp_path / "a.db"
    seed(path)
    with closing(sqlite3.connect(path)) as conn:
        columns = [row[1] for row in conn.execute("PRAGMA table_info(customers)")]
    assert columns == ["customer_id", "name", "previous_claims"]


def test_main_prints_counts(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("UNDERCOVER_DB", str(tmp_path / "a.db"))
    main()
    assert "claims: 25" in capsys.readouterr().out


def test_app_seeds_a_missing_database_on_start(tmp_path, monkeypatch):
    path = tmp_path / "new.db"
    monkeypatch.setenv("UNDERCOVER_DB", str(path))
    with TestClient(app) as client:
        assert len(client.get("/api/claims").json()) == 25
    assert path.exists()
