"""Build the database from the business data in data/."""

import json
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any

from backend.db import SCHEMA, db_path

DATA = Path(__file__).parent.parent / "data"


def load(name: str) -> Any:
    """Read one JSON file from data/."""
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def seed(path: Path) -> dict[str, int]:
    """Rebuild the database at path and return the number of rows in each table."""
    plans = load("plans.json")["plans"]
    policies = [
        {
            **policy,
            "add_ons": json.dumps(policy["add_ons"]),
            "trip": json.dumps(policy["trip"]),
            "travelers": json.dumps(policy["travelers"]),
        }
        for policy in load("policies.json")
    ]
    customers = [
        {
            "customer_id": customer["customer_id"],
            "name": customer["name"],
            "previous_claims": json.dumps(customer["previous_claims"]),
        }
        for customer in load("customers.json")
    ]
    handlers = load("handlers.json")
    claims = [
        {
            **claim,
            "items": json.dumps(claim["items"]),
            "documents": json.dumps(claim["documents"]),
            "status": "waiting",
        }
        for claim in load("claims.json")
    ]
    limit = load("company.json")["payout_approval_limit"]

    path.unlink(missing_ok=True)
    with closing(sqlite3.connect(path)) as conn, conn:
        conn.executescript(SCHEMA)
        conn.execute(
            "INSERT INTO settings VALUES ('payout_approval_limit', ?)", (limit,)
        )
        conn.executemany(
            "INSERT INTO plans VALUES (:plan, :name, :trip_cancellation_max,"
            " :trip_delay_waiting_hours, :trip_delay_max,"
            " :baggage_delay_waiting_hours, :baggage_delay_max, :baggage_max,"
            " :per_item_limit, :passport_max, :emergency_medical_max, :deductible)",
            plans,
        )
        conn.executemany(
            "INSERT INTO policies VALUES (:policy_id, :customer_id, :plan,"
            " :add_ons, :purchased_on, :sold_through, :trip, :travelers, :status)",
            policies,
        )
        conn.executemany(
            "INSERT INTO customers VALUES (:customer_id, :name, :previous_claims)",
            customers,
        )
        conn.executemany(
            "INSERT INTO handlers VALUES"
            " (:handler_id, :name, :role, :can_approve_over_limit)",
            handlers,
        )
        conn.executemany(
            "INSERT INTO claims (claim_id, policy_id, customer_id, claim_type,"
            " submitted_on, incident_date, incident_location, summary, story,"
            " items, amount_claimed, documents, status) VALUES"
            " (:claim_id, :policy_id, :customer_id, :claim_type, :submitted_on,"
            " :incident_date, :incident_location, :summary, :story, :items,"
            " :amount_claimed, :documents, :status)",
            claims,
        )
    return {
        "claims": len(claims),
        "policies": len(policies),
        "customers": len(customers),
        "plans": len(plans),
        "handlers": len(handlers),
    }


def main() -> None:
    """Rebuild the database and print what it holds."""
    for table, count in seed(db_path()).items():
        print(f"{table}: {count}")


if __name__ == "__main__":
    main()
