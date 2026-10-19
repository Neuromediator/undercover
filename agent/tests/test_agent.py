import sys
from typing import Any

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from agent import main


class StubModel(GenericFakeChatModel):
    """A chat model that gives scripted replies in place of a real model."""

    seen: list[Any] = []

    def bind_tools(self, tools, **kwargs):
        return self

    def _generate(self, messages, *args, **kwargs):
        self.seen.append(messages)
        return super()._generate(messages, *args, **kwargs)


def stub(*replies):
    return StubModel(messages=iter(replies))


def tool_call(name, args):
    return AIMessage(
        content="", tool_calls=[{"name": name, "args": args, "id": f"call-{name}"}]
    )


def decide(claim_id, decision, payout):
    return tool_call(
        "decide_claim",
        {
            "claim_id": claim_id,
            "decision": decision,
            "payout": payout,
            "reason": "The wording decides it.",
            "policy_section": "Section 3, Trip Delay",
        },
    )


def pay(claim_id, amount):
    return tool_call("pay_claim", {"claim_id": claim_id, "amount": amount})


def test_approve_and_pay(client):
    llm = stub(
        tool_call("get_claim", {"claim_id": "CLM-1001"}),
        decide("CLM-1001", "approve", 420),
        pay("CLM-1001", 420),
        AIMessage(content="Approved, payout $420.00."),
    )
    assert main.run("CLM-1001", "t1", llm) == "Approved, payout $420.00."
    claim = client.get("/api/claims/CLM-1001").json()
    assert claim["status"] == "decided"
    assert claim["paid_amount"] == 420
    assert claim["reason"] == "The wording decides it."
    steps = client.get("/api/claims/CLM-1001/steps").json()
    assert [step["kind"] for step in steps] == [
        "message",
        "tool_call",
        "tool_result",
        "tool_call",
        "tool_result",
        "tool_call",
        "tool_result",
        "message",
    ]
    assert steps[0]["text"] == "Run started on thread t1"
    assert steps[1]["text"] == "get_claim(claim_id='CLM-1001')"
    assert "My flight home from Rome" in steps[2]["text"]
    assert steps[-1]["text"] == "Approved, payout $420.00."
    assert {step["thread_id"] for step in steps} == {"t1"}


def test_a_payout_over_the_limit_cannot_be_paid(client):
    llm = stub(
        decide("CLM-1008", "approve", 2200),
        pay("CLM-1008", 2200),
        AIMessage(content="Approved, waiting for a handler's sign-off."),
    )
    main.run("CLM-1008", "t1", llm)
    claim = client.get("/api/claims/CLM-1008").json()
    assert claim["status"] == "awaiting_signoff"
    assert claim["paid_amount"] is None
    results = [
        step["text"]
        for step in client.get("/api/claims/CLM-1008/steps").json()
        if step["kind"] == "tool_result"
    ]
    assert results[0] == (
        "decide_claim: "
        "{'status': 'awaiting_signoff', 'decision': 'approve', "
        "'payout': 2200.0, 'paid_amount': None}"
    )
    assert results[1].startswith("pay_claim: Refused (409): payment is on hold")
    assert "sign-off" in results[1]


@pytest.mark.parametrize(
    ("claim_id", "decision"), [("CLM-1004", "decline"), ("CLM-1005", "refer")]
)
def test_decline_and_refer(client, claim_id, decision):
    main.run(
        claim_id, "t1", stub(decide(claim_id, decision, 0), AIMessage(content="Done."))
    )
    claim = client.get(f"/api/claims/{claim_id}").json()
    assert claim["status"] == "decided"
    assert claim["decision"] == decision
    assert claim["reason"] == "The wording decides it."
    assert claim["policy_section"] == "Section 3, Trip Delay"


def test_a_stuck_claim_can_be_run_again(client):
    main.run("CLM-1001", "t1", stub(AIMessage(content="I could not decide.")))
    assert client.get("/api/claims/CLM-1001").json()["status"] == "in_progress"
    main.run(
        "CLM-1001",
        "t2",
        stub(decide("CLM-1001", "decline", 0), AIMessage(content="Declined.")),
    )
    assert client.get("/api/claims/CLM-1001").json()["status"] == "decided"
    threads = [
        step["thread_id"] for step in client.get("/api/claims/CLM-1001/steps").json()
    ]
    assert set(threads) == {"t1", "t2"}


def test_the_backend_instructions_are_the_system_prompt():
    llm = stub(AIMessage(content="Done."))
    main.run("CLM-1001", "t1", llm)
    system, user = llm.seen[0][:2]
    assert system.content.startswith("# The UnderCover Agent")
    assert user.content == "Decide claim CLM-1001."


def test_a_text_reply_with_a_tool_call_gives_two_steps(client):
    reply = AIMessage(
        content="Checking the claim.",
        tool_calls=[{"name": "get_claim", "args": {"claim_id": "CLM-1001"}, "id": "1"}],
    )
    main.run("CLM-1001", "t1", stub(reply, AIMessage(content="Done.")))
    steps = client.get("/api/claims/CLM-1001/steps").json()
    assert [step["text"] for step in steps[1:3]] == [
        "Checking the claim.",
        "get_claim(claim_id='CLM-1001')",
    ]


def test_run_on_an_unknown_claim_fails():
    # The test client is built on httpx2, so its error is not httpx's.
    with pytest.raises(Exception, match="404"):
        main.run("CLM-9999", "t1", stub())


def test_the_tools_read_the_records():
    assert "CLM-0412" in main.get_claim_history.invoke({"customer_id": "CUS-3001"})
    assert '"plan":"premium"' in main.get_policy.invoke(
        {"policy_id": "POL-2001"}
    ).replace(" ", "")
    wording = main.get_policy_wording.invoke({})
    assert wording.startswith("# UnderCover Travel Insurance: Policy Wording")
    assert main.get_claim.invoke({"claim_id": "CLM-1001"}).startswith("{")


def test_the_tools_pass_on_a_refusal():
    refused = main.get_claim.invoke({"claim_id": "CLM-9999"})
    assert refused == "Refused (404): claim CLM-9999 not found"
    claim = {
        "claim_id": "CLM-1001",
        "decision": "approve",
        "payout": 100,
        "reason": "r",
        "policy_section": "s",
    }
    assert main.decide_claim.invoke(claim) == (
        "Refused (409): claim CLM-1001 is waiting; "
        "only a claim in progress can be decided"
    )


def test_a_refusal_for_bad_input_is_one_plain_line():
    main.call("POST", "/api/claims/CLM-1001/start", {"thread_id": "t1"})
    claim = {
        "claim_id": "CLM-1001",
        "decision": "approve",
        "payout": 0,
        "reason": "r",
        "policy_section": "s",
    }
    assert main.decide_claim.invoke(claim) == (
        "Refused (422): Value error, an approval needs a payout above 0; "
        "a decline or a referral needs 0"
    )
    assert main.pay_claim.invoke({"claim_id": "CLM-1001", "amount": 1}) == (
        "Refused (409): claim CLM-1001 is not approved, so it is not paid"
    )


def test_waiting_claims():
    ids = main.waiting_claims()
    assert len(ids) == 25
    assert ids[0] == "CLM-1001"


def test_main_works_the_named_claims(monkeypatch, capsys):
    worked = []
    monkeypatch.setattr(sys, "argv", ["agent", "CLM-1003", "CLM-1002"])
    monkeypatch.setattr(
        main,
        "run",
        lambda claim_id, thread_id: worked.append((claim_id, thread_id)) or "Done.",
    )
    main.main()
    assert [claim_id for claim_id, _ in worked] == ["CLM-1003", "CLM-1002"]
    assert worked[0][1].startswith("CLM-1003-")
    assert capsys.readouterr().out == "CLM-1003: Done.\nCLM-1002: Done.\n"


def test_main_works_every_waiting_claim_by_default(monkeypatch):
    worked = []
    monkeypatch.setattr(sys, "argv", ["agent"])
    monkeypatch.setattr(
        main, "run", lambda claim_id, thread_id: worked.append(claim_id) or "Done."
    )
    main.main()
    assert len(worked) == 25


def test_model_name(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("MODEL_NAME", raising=False)
    assert main.model().model_name == "openai/gpt-6-luna"
    monkeypatch.setenv("MODEL_NAME", "openrouter/free")
    assert main.model().model_name == "openrouter/free"
