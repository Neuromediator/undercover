"""The claims queue and the claim workflow."""

from fastapi import APIRouter

from backend.db import Db, find, to_dict
from backend.models import Claim, ClaimSummary

router = APIRouter(prefix="/api")


@router.get("/claims", operation_id="list_claims")
def list_claims(db: Db) -> list[ClaimSummary]:
    """List every claim in the queue with its stage and outcome."""
    rows = db.execute(
        "SELECT claims.*, customers.name AS customer_name FROM claims"
        " JOIN customers USING (customer_id) ORDER BY claim_id"
    ).fetchall()
    return [ClaimSummary.model_validate(to_dict(row)) for row in rows]


@router.get("/claims/{claim_id}", operation_id="get_claim")
def get_claim(claim_id: str, db: Db) -> Claim:
    """Get a claim in full, with its decision, sign-off and payment."""
    row = find(
        db,
        "SELECT claims.*, customers.name AS customer_name FROM claims"
        " JOIN customers USING (customer_id) WHERE claim_id = ?",
        claim_id,
        "claim",
    )
    return Claim.model_validate(row)
