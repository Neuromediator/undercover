"""The SQLite database."""

import json
import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, HTTPException

DEFAULT_PATH = Path(__file__).parent / "undercover.db"
JSON_COLUMNS = {"items", "documents", "add_ons", "trip", "travelers", "previous_claims"}

SCHEMA = """
CREATE TABLE settings (key TEXT PRIMARY KEY, value);

CREATE TABLE plans (
    plan TEXT PRIMARY KEY,
    name TEXT,
    trip_cancellation_max REAL,
    trip_delay_waiting_hours INTEGER,
    trip_delay_max REAL,
    baggage_delay_waiting_hours INTEGER,
    baggage_delay_max REAL,
    baggage_max REAL,
    per_item_limit REAL,
    passport_max REAL,
    emergency_medical_max REAL,
    deductible REAL
);

CREATE TABLE policies (
    policy_id TEXT PRIMARY KEY,
    customer_id TEXT,
    plan TEXT,
    add_ons TEXT,
    purchased_on TEXT,
    sold_through TEXT,
    trip TEXT,
    travelers TEXT,
    status TEXT
);

CREATE TABLE customers (
    customer_id TEXT PRIMARY KEY,
    name TEXT,
    previous_claims TEXT
);

CREATE TABLE handlers (
    handler_id TEXT PRIMARY KEY,
    name TEXT,
    role TEXT,
    can_approve_over_limit INTEGER
);

CREATE TABLE claims (
    claim_id TEXT PRIMARY KEY,
    policy_id TEXT,
    customer_id TEXT,
    claim_type TEXT,
    submitted_on TEXT,
    incident_date TEXT,
    incident_location TEXT,
    summary TEXT,
    story TEXT,
    items TEXT,
    amount_claimed REAL,
    documents TEXT,
    status TEXT,
    decision TEXT,
    payout REAL,
    reason TEXT,
    policy_section TEXT,
    decided_at TEXT,
    signed_off_by TEXT,
    signed_off_at TEXT,
    paid_amount REAL,
    paid_at TEXT
);

CREATE TABLE steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id TEXT,
    thread_id TEXT,
    kind TEXT,
    text TEXT,
    created_at TEXT
);
"""


def db_path() -> Path:
    """Return the database file, from UNDERCOVER_DB if it is set."""
    return Path(os.getenv("UNDERCOVER_DB", DEFAULT_PATH))


def get_db() -> Iterator[sqlite3.Connection]:
    """Open a connection for one request and commit when the request succeeds."""
    with closing(sqlite3.connect(db_path())) as conn, conn:
        conn.row_factory = sqlite3.Row
        yield conn


Db = Annotated[sqlite3.Connection, Depends(get_db)]


def to_dict(row: sqlite3.Row) -> dict[str, Any]:
    """Turn a row into a dict, reading the JSON columns."""
    return {
        key: json.loads(value) if key in JSON_COLUMNS else value
        for key, value in dict(row).items()
    }


def find(db: sqlite3.Connection, sql: str, key: str, what: str) -> dict[str, Any]:
    """Return the one row the query finds for key, or answer 404."""
    row = db.execute(sql, (key,)).fetchone()
    if row is None:
        raise HTTPException(404, f"{what} {key} not found")
    return to_dict(row)
