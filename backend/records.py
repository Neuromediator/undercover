"""The insurer's records: policies, customers, handlers and the wording."""

from fastapi import APIRouter

from backend.db import Db, find, to_dict
from backend.models import ClaimHistory, Handler, Policy, Text
from backend.seed import DATA

router = APIRouter(prefix="/api")


@router.get("/policies/{policy_id}", operation_id="get_policy")
def get_policy(policy_id: str, db: Db) -> Policy:
    """Get a policy with its plan's limits, add-ons, trip and travelers."""
    policy = find(db, "SELECT * FROM policies WHERE policy_id = ?", policy_id, "policy")
    plan = find(db, "SELECT * FROM plans WHERE plan = ?", policy["plan"], "plan")
    return Policy.model_validate({**policy, "plan": plan})


@router.get("/customers/{customer_id}/claim-history", operation_id="get_claim_history")
def get_claim_history(customer_id: str, db: Db) -> ClaimHistory:
    """Get the earlier claims of a customer."""
    sql = "SELECT customer_id, previous_claims FROM customers WHERE customer_id = ?"
    return ClaimHistory.model_validate(find(db, sql, customer_id, "customer"))


@router.get("/policy-wording", operation_id="get_policy_wording")
def get_policy_wording() -> Text:
    """Get the policy wording as text."""
    return Text(text=(DATA / "policy_wording.md").read_text(encoding="utf-8"))


@router.get("/handlers", operation_id="list_handlers")
def list_handlers(db: Db) -> list[Handler]:
    """List the claims handlers."""
    rows = db.execute("SELECT * FROM handlers ORDER BY handler_id").fetchall()
    return [Handler.model_validate(to_dict(row)) for row in rows]
