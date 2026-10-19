"""The claim workflow: working a claim, deciding it, paying it and signing it off."""

import sqlite3
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from backend.claims import get_claim
from backend.db import Db, find, payout_limit, to_dict
from backend.models import (
    Claim,
    NewDecision,
    NewPayment,
    NewRun,
    NewSignOff,
    NewStep,
    Step,
)

router = APIRouter(prefix="/api")


def now() -> str:
    """Return the current time in UTC."""
    return datetime.now(UTC).isoformat(timespec="seconds")


def claim_row(db: sqlite3.Connection, claim_id: str) -> dict[str, Any]:
    """Return a claim's row, or answer 404."""
    return find(db, "SELECT * FROM claims WHERE claim_id = ?", claim_id, "claim")


def money(amount: float) -> str:
    """Write an amount in US dollars."""
    return f"${amount:,.2f}"


def needs_sign_off(db: sqlite3.Connection, claim: dict[str, Any]) -> bool:
    """Say whether the claim's payout is over the limit and nobody has signed it off."""
    return claim["payout"] > payout_limit(db) and claim["signed_off_by"] is None


def record_step(
    db: sqlite3.Connection, claim_id: str, thread_id: str, kind: str, text: str
) -> Step:
    """Add a step to a claim's activity."""
    cursor = db.execute(
        "INSERT INTO steps (claim_id, thread_id, kind, text, created_at)"
        " VALUES (?, ?, ?, ?, ?)",
        (claim_id, thread_id, kind, text, now()),
    )
    row = find(db, "SELECT * FROM steps WHERE id = ?", str(cursor.lastrowid), "step")
    return Step.model_validate(row)


def pay(db: sqlite3.Connection, claim_id: str, amount: float) -> None:
    """Record the payment of a claim's approved payout."""
    db.execute(
        "UPDATE claims SET paid_amount = ?, paid_at = ? WHERE claim_id = ?",
        (amount, now(), claim_id),
    )


@router.get("/claims/{claim_id}/steps", operation_id="list_steps")
def list_steps(claim_id: str, db: Db) -> list[Step]:
    """List what the agent did on a claim, in order."""
    claim_row(db, claim_id)
    rows = db.execute(
        "SELECT * FROM steps WHERE claim_id = ? ORDER BY id", (claim_id,)
    ).fetchall()
    return [Step.model_validate(to_dict(row)) for row in rows]


@router.post("/claims/{claim_id}/start", operation_id="start_claim")
def start_claim(claim_id: str, run: NewRun, db: Db) -> Claim:
    """Mark a claim as in progress when the agent starts working it."""
    claim = claim_row(db, claim_id)
    if claim["status"] not in {"waiting", "in_progress"}:
        raise HTTPException(
            409, f"claim {claim_id} is {claim['status']} and cannot be started"
        )
    db.execute(
        "UPDATE claims SET status = 'in_progress' WHERE claim_id = ?", (claim_id,)
    )
    record_step(
        db, claim_id, run.thread_id, "message", f"Run started on thread {run.thread_id}"
    )
    return get_claim(claim_id, db)


@router.post("/claims/{claim_id}/steps", operation_id="add_step")
def add_step(claim_id: str, step: NewStep, db: Db) -> Step:
    """Record one thing the agent did on a claim."""
    claim_row(db, claim_id)
    return record_step(db, claim_id, step.thread_id, step.kind, step.text)


@router.post("/claims/{claim_id}/decision", operation_id="decide_claim")
def decide_claim(claim_id: str, decision: NewDecision, db: Db) -> Claim:
    """Record the decision on a claim that is in progress."""
    claim = claim_row(db, claim_id)
    if claim["status"] != "in_progress":
        raise HTTPException(
            409,
            f"claim {claim_id} is {claim['status']}; only a claim in progress "
            "can be decided",
        )
    payout = round(decision.payout, 2)
    held = decision.decision == "approve" and payout > payout_limit(db)
    db.execute(
        "UPDATE claims SET status = ?, decision = ?, payout = ?, reason = ?,"
        " policy_section = ?, decided_at = ? WHERE claim_id = ?",
        (
            "awaiting_signoff" if held else "decided",
            decision.decision,
            payout,
            decision.reason,
            decision.policy_section,
            now(),
            claim_id,
        ),
    )
    return get_claim(claim_id, db)


@router.post("/claims/{claim_id}/payment", operation_id="pay_claim")
def pay_claim(claim_id: str, payment: NewPayment, db: Db) -> Claim:
    """Pay an approved claim, unless its payout is over the limit and not signed off."""
    claim = claim_row(db, claim_id)
    if claim["decision"] != "approve":
        raise HTTPException(409, f"claim {claim_id} is not approved, so it is not paid")
    if claim["paid_amount"] is not None:
        raise HTTPException(409, f"claim {claim_id} has already been paid")
    if needs_sign_off(db, claim):
        raise HTTPException(
            409,
            f"payment is on hold: the payout of {money(claim['payout'])} is over the "
            f"{money(payout_limit(db))} limit and needs a handler's sign-off",
        )
    amount = round(payment.amount, 2)
    if amount != claim["payout"]:
        raise HTTPException(
            409, f"the approved payout is {money(claim['payout'])}; pay exactly that"
        )
    pay(db, claim_id, amount)
    return get_claim(claim_id, db)


@router.post("/claims/{claim_id}/sign-off", operation_id="sign_off_claim")
def sign_off_claim(claim_id: str, sign_off: NewSignOff, db: Db) -> Claim:
    """Let a handler sign off a payout over the limit, which pays the claim."""
    claim = claim_row(db, claim_id)
    if claim["status"] != "awaiting_signoff":
        raise HTTPException(
            409, f"claim {claim_id} is {claim['status']} and needs no sign-off"
        )
    handler = find(
        db,
        "SELECT * FROM handlers WHERE handler_id = ?",
        sign_off.handler_id,
        "handler",
    )
    if not handler["can_approve_over_limit"]:
        raise HTTPException(
            403, f"{handler['name']} may not sign off payouts over the limit"
        )
    db.execute(
        "UPDATE claims SET status = 'decided', signed_off_by = ?, signed_off_at = ?"
        " WHERE claim_id = ?",
        (handler["handler_id"], now(), claim_id),
    )
    pay(db, claim_id, claim["payout"])
    return get_claim(claim_id, db)
