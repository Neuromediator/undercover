import os
import sqlite3
from contextlib import closing

import pytest

SECTION = "Section 5, Baggage and Personal Effects"


def start(client, claim_id="CLM-1001"):
    return client.post(f"/api/claims/{claim_id}/start", json={"thread_id": "t1"})


def decide(client, claim_id="CLM-1001", decision="approve", payout=420.0):
    return client.post(
        f"/api/claims/{claim_id}/decision",
        json={
            "decision": decision,
            "payout": payout,
            "reason": "The wording covers it.",
            "policy_section": SECTION,
        },
    )


def pay(client, amount, claim_id="CLM-1001"):
    return client.post(f"/api/claims/{claim_id}/payment", json={"amount": amount})


def sign_off(client, handler_id="HND-01", claim_id="CLM-1008"):
    return client.post(
        f"/api/claims/{claim_id}/sign-off", json={"handler_id": handler_id}
    )


def hold_for_sign_off(client, claim_id="CLM-1008", payout=2200.0):
    start(client, claim_id)
    return decide(client, claim_id, payout=payout)


def test_start_claim(client):
    response = start(client)
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"
    queue = {claim["claim_id"]: claim for claim in client.get("/api/claims").json()}
    assert queue["CLM-1001"]["status"] == "in_progress"
    assert queue["CLM-1002"]["status"] == "waiting"


def test_start_claim_again(client):
    start(client)
    assert start(client).status_code == 200
    steps = client.get("/api/claims/CLM-1001/steps").json()
    assert [step["text"] for step in steps] == ["Run started on thread t1"] * 2


def test_start_decided_claim(client):
    start(client)
    decide(client)
    response = start(client)
    assert response.status_code == 409
    assert "decided" in response.json()["detail"]


def test_unknown_claim(client):
    assert start(client, "CLM-9999").status_code == 404
    assert decide(client, "CLM-9999").status_code == 404
    assert pay(client, 1.0, "CLM-9999").status_code == 404
    assert sign_off(client, claim_id="CLM-9999").status_code == 404
    assert client.get("/api/claims/CLM-9999/steps").status_code == 404
    step = {"thread_id": "t1", "kind": "message", "text": "Hello"}
    assert client.post("/api/claims/CLM-9999/steps", json=step).status_code == 404


def test_steps_come_back_in_order(client):
    for kind, text in [("tool_call", "get_claim"), ("tool_result", "{}")]:
        step = {"thread_id": "t1", "kind": kind, "text": text}
        response = client.post("/api/claims/CLM-1001/steps", json=step)
        assert response.status_code == 200
        assert response.json()["created_at"]
    steps = client.get("/api/claims/CLM-1001/steps").json()
    assert [step["kind"] for step in steps] == ["tool_call", "tool_result"]
    assert [step["id"] for step in steps] == sorted(step["id"] for step in steps)
    assert all(step["created_at"] and step["thread_id"] == "t1" for step in steps)
    assert client.get("/api/claims/CLM-1002/steps").json() == []


def test_step_kind_is_checked(client):
    step = {"thread_id": "t1", "kind": "thought", "text": "Hmm"}
    assert client.post("/api/claims/CLM-1001/steps", json=step).status_code == 422


def test_decide_before_start(client):
    response = decide(client)
    assert response.status_code == 409
    assert "waiting" in response.json()["detail"]


def test_decide_twice(client):
    start(client)
    assert decide(client).status_code == 200
    assert decide(client, payout=100.0).status_code == 409


def test_approve_and_pay(client):
    start(client)
    claim = decide(client).json()
    assert claim["status"] == "decided"
    assert claim["decision"] == "approve"
    assert claim["payout"] == 420
    assert claim["reason"] == "The wording covers it."
    assert claim["policy_section"] == SECTION
    assert claim["decided_at"]
    assert claim["paid_amount"] is None
    paid = pay(client, 420).json()
    assert paid["paid_amount"] == 420
    assert paid["paid_at"]
    assert pay(client, 420).status_code == 409


def test_payment_must_match_the_payout(client):
    start(client)
    decide(client)
    response = pay(client, 900)
    assert response.status_code == 409
    assert "$420.00" in response.json()["detail"]
    assert client.get("/api/claims/CLM-1001").json()["paid_amount"] is None


def test_nothing_to_pay_before_a_decision_or_after_a_decline(client):
    assert pay(client, 420).status_code == 409
    start(client)
    assert pay(client, 420).status_code == 409
    decide(client, decision="decline", payout=0)
    assert pay(client, 420).status_code == 409


def test_payout_over_the_limit_is_held(client):
    claim = hold_for_sign_off(client).json()
    assert claim["status"] == "awaiting_signoff"
    for amount in (2200, 1000, 5000):
        response = pay(client, amount, "CLM-1008")
        assert response.status_code == 409
        assert "sign-off" in response.json()["detail"]
    held = client.get("/api/claims/CLM-1008").json()
    assert held["paid_amount"] is None
    assert held["status"] == "awaiting_signoff"


def test_sign_off_pays_the_claim(client):
    hold_for_sign_off(client)
    claim = sign_off(client).json()
    assert claim["status"] == "decided"
    assert claim["signed_off_by"] == "HND-01"
    assert claim["signed_off_at"]
    assert claim["paid_amount"] == 2200
    assert claim["paid_at"]
    assert sign_off(client).status_code == 409
    assert pay(client, 2200, "CLM-1008").status_code == 409


def test_sign_off_by_an_unknown_handler(client):
    hold_for_sign_off(client)
    response = sign_off(client, handler_id="HND-99")
    assert response.status_code == 404
    assert client.get("/api/claims/CLM-1008").json()["paid_amount"] is None


def test_sign_off_by_a_handler_who_may_not(client):
    hold_for_sign_off(client)
    with closing(sqlite3.connect(os.environ["UNDERCOVER_DB"])) as conn, conn:
        conn.execute(
            "UPDATE handlers SET can_approve_over_limit = 0 WHERE handler_id = 'HND-02'"
        )
    response = sign_off(client, handler_id="HND-02")
    assert response.status_code == 403
    assert "Marcus Oyelaran" in response.json()["detail"]
    assert client.get("/api/claims/CLM-1008").json()["paid_amount"] is None


@pytest.mark.parametrize("setup", [None, "start", "decide_under_limit"])
def test_sign_off_needs_a_held_claim(client, setup):
    if setup:
        start(client, "CLM-1001")
    if setup == "decide_under_limit":
        decide(client)
    assert sign_off(client, claim_id="CLM-1001").status_code == 409


@pytest.mark.parametrize(
    ("payout", "stage", "paid"),
    [(1000.00, "decided", True), (1000.01, "awaiting_signoff", False)],
)
def test_the_limit_is_over_1000(client, payout, stage, paid):
    start(client)
    assert decide(client, payout=payout).json()["status"] == stage
    response = pay(client, payout)
    assert (response.status_code == 200) is paid


@pytest.mark.parametrize(
    ("decision", "payout"),
    [("decline", 10), ("refer", 0.01), ("approve", 0), ("approve", -5)],
)
def test_payout_must_fit_the_decision(client, decision, payout):
    start(client)
    assert decide(client, decision=decision, payout=payout).status_code == 422
    assert client.get("/api/claims/CLM-1001").json()["status"] == "in_progress"


@pytest.mark.parametrize(
    ("claim_id", "decision"), [("CLM-1004", "decline"), ("CLM-1005", "refer")]
)
def test_decline_and_refer_are_decided(client, claim_id, decision):
    start(client, claim_id)
    claim = decide(client, claim_id, decision=decision, payout=0).json()
    assert claim["status"] == "decided"
    assert claim["decision"] == decision
    assert claim["payout"] == 0
    assert claim["reason"] == "The wording covers it."
    assert claim["policy_section"] == SECTION
    assert claim["paid_amount"] is None
