"""The shapes of what the API takes and answers."""

from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator

Stage = Literal["waiting", "in_progress", "awaiting_signoff", "decided"]
Outcome = Literal["approve", "decline", "refer"]
StepKind = Literal["message", "tool_call", "tool_result"]


class ClaimSummary(BaseModel):
    """A claim as a row in the queue."""

    claim_id: str
    claim_type: str
    customer_name: str
    summary: str
    amount_claimed: float
    submitted_on: str
    status: Stage
    decision: Outcome | None
    payout: float | None
    paid_amount: float | None


class Item(BaseModel):
    """One thing the customer is claiming."""

    description: str
    category: str
    amount: float


class Document(BaseModel):
    """A supporting document, as text."""

    name: str
    type: str
    content: str


class Claim(ClaimSummary):
    """A claim in full."""

    policy_id: str
    customer_id: str
    incident_date: str
    incident_location: str
    story: str
    items: list[Item]
    documents: list[Document]
    reason: str | None
    policy_section: str | None
    decided_at: str | None
    signed_off_by: str | None
    signed_off_at: str | None
    paid_at: str | None


class Plan(BaseModel):
    """A plan and its limits."""

    plan: str
    name: str
    trip_cancellation_max: float
    trip_delay_waiting_hours: int
    trip_delay_max: float
    baggage_delay_waiting_hours: int
    baggage_delay_max: float
    baggage_max: float
    per_item_limit: float
    passport_max: float
    emergency_medical_max: float
    deductible: float


class Trip(BaseModel):
    """The covered trip."""

    destination: str
    departs_on: str
    returns_on: str
    trip_cost: float


class Policy(BaseModel):
    """A policy with its plan."""

    policy_id: str
    customer_id: str
    plan: Plan
    add_ons: list[str]
    purchased_on: str
    sold_through: str
    trip: Trip
    travelers: list[str]
    status: str


class PreviousClaim(BaseModel):
    """An earlier claim by the customer."""

    claim_id: str
    filed_on: str
    incident_date: str
    claim_type: str
    summary: str
    outcome: str
    amount_paid: float


class ClaimHistory(BaseModel):
    """A customer's earlier claims."""

    customer_id: str
    previous_claims: list[PreviousClaim]


class Text(BaseModel):
    """A document as text."""

    text: str


class Handler(BaseModel):
    """A claims handler."""

    handler_id: str
    name: str
    role: str
    can_approve_over_limit: bool


class Step(BaseModel):
    """One thing the agent did on a claim."""

    id: int
    claim_id: str
    thread_id: str
    kind: StepKind
    text: str
    created_at: str


class NewRun(BaseModel):
    """The run that starts working a claim."""

    thread_id: str


class NewStep(BaseModel):
    """A step to record."""

    thread_id: str
    kind: StepKind
    text: str


class NewDecision(BaseModel):
    """The agent's decision on a claim."""

    decision: Outcome
    payout: float = Field(ge=0)
    reason: str
    policy_section: str

    @model_validator(mode="after")
    def payout_fits_the_decision(self) -> Self:
        """Require a payout for an approval and none for anything else."""
        if (self.decision == "approve") != (self.payout > 0):
            raise ValueError(
                "an approval needs a payout above 0; a decline or a referral needs 0"
            )
        return self


class NewPayment(BaseModel):
    """A payment of an approved claim."""

    amount: float


class NewSignOff(BaseModel):
    """The handler who signs off a payout over the limit."""

    handler_id: str
