"""The UnderCover Agent."""

import os
import sys
from typing import Any, Literal
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

load_dotenv(override=True)

BACKEND_URL = "http://localhost:8000"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-6-luna"
DECISION_FIELDS = ("status", "decision", "payout", "paid_amount")


def backend() -> httpx.Client:
    """Return a client for the UnderCover backend."""
    return httpx.Client(base_url=BACKEND_URL, timeout=10)


def call(method: str, path: str, body: dict[str, Any] | None = None) -> httpx.Response:
    """Call the backend and return its response."""
    with backend() as client:
        return client.request(method, path, json=body)


def reason(detail: str | list[dict[str, Any]]) -> str:
    """Write the backend's reason for refusing as one plain line."""
    if isinstance(detail, str):
        return detail
    return "; ".join(
        f"{'.'.join(str(part) for part in error['loc'][1:])} {error['msg']}".strip()
        for error in detail
    )


def answer(response: httpx.Response) -> str:
    """Give the model the backend's answer, or its reason for refusing."""
    if response.is_error:
        return f"Refused ({response.status_code}): {reason(response.json()['detail'])}"
    return response.text


def outcome(response: httpx.Response) -> str:
    """Give the model the claim's outcome so far, or the reason for refusing."""
    if response.is_error:
        return answer(response)
    claim = response.json()
    return str({field: claim[field] for field in DECISION_FIELDS})


@tool
def get_claim(claim_id: str) -> str:
    """Get a claim in full: the story, the items claimed and the documents."""
    return answer(call("GET", f"/api/claims/{claim_id}"))


@tool
def get_policy(policy_id: str) -> str:
    """Get a policy with its plan's limits, add-ons, trip and travelers."""
    return answer(call("GET", f"/api/policies/{policy_id}"))


@tool
def get_claim_history(customer_id: str) -> str:
    """Get the earlier claims of a customer."""
    return answer(call("GET", f"/api/customers/{customer_id}/claim-history"))


@tool
def get_policy_wording() -> str:
    """Get the policy wording, the contract that decides every claim."""
    return call("GET", "/api/policy-wording").json()["text"]


@tool
def decide_claim(
    claim_id: str,
    decision: Literal["approve", "decline", "refer"],
    payout: float,
    reason: str,
    policy_section: str,
) -> str:
    """Record the decision on a claim. The payout is 0 unless the claim is approved."""
    body = {
        "decision": decision,
        "payout": payout,
        "reason": reason,
        "policy_section": policy_section,
    }
    return outcome(call("POST", f"/api/claims/{claim_id}/decision", body))


@tool
def pay_claim(claim_id: str, amount: float) -> str:
    """Pay an approved claim. The amount must be exactly the approved payout."""
    return outcome(call("POST", f"/api/claims/{claim_id}/payment", {"amount": amount}))


TOOLS = [
    get_claim,
    get_policy,
    get_claim_history,
    get_policy_wording,
    decide_claim,
    pay_claim,
]


def model() -> ChatOpenAI:
    """Return the model named in MODEL_NAME, or GPT-6 Luna by default."""
    name = os.getenv("MODEL_NAME")
    return ChatOpenAI(
        model=name or DEFAULT_MODEL,
        base_url=OPENROUTER_BASE_URL,
        api_key=SecretStr(os.environ["OPENROUTER_API_KEY"]),
        reasoning_effort=None if name else "low",
    )


def steps(message: BaseMessage) -> list[tuple[str, str]]:
    """Describe what a message shows of the agent's work as (kind, text) steps."""
    if isinstance(message, ToolMessage):
        return [("tool_result", f"{message.name}: {message.text}")]
    if not isinstance(message, AIMessage):
        return []
    found: list[tuple[str, str]] = [("message", message.text)] if message.text else []
    for tool_call in message.tool_calls:
        arguments = ", ".join(
            f"{key}={value!r}" for key, value in tool_call["args"].items()
        )
        found.append(("tool_call", f"{tool_call['name']}({arguments})"))
    return found


def run(claim_id: str, thread_id: str, llm: BaseChatModel | None = None) -> str:
    """Work one claim, posting each step to the backend, and return the final reply."""
    instructions = call("GET", "/api/instructions").json()["text"]
    call(
        "POST", f"/api/claims/{claim_id}/start", {"thread_id": thread_id}
    ).raise_for_status()
    agent = create_agent(llm or model(), tools=TOOLS, system_prompt=instructions)
    reply = ""
    updates = agent.stream(
        {"messages": [{"role": "user", "content": f"Decide claim {claim_id}."}]},
        config={"configurable": {"thread_id": thread_id}},
        stream_mode="updates",
    )
    for update in updates:
        for node in update.values():
            for message in node["messages"]:
                for kind, text in steps(message):
                    step = {"thread_id": thread_id, "kind": kind, "text": text}
                    call(
                        "POST", f"/api/claims/{claim_id}/steps", step
                    ).raise_for_status()
                if isinstance(message, AIMessage):
                    reply = message.text
    return reply


def waiting_claims() -> list[str]:
    """Return the ids of the claims nobody has started."""
    claims = call("GET", "/api/claims").json()
    return [claim["claim_id"] for claim in claims if claim["status"] == "waiting"]


def main() -> None:
    """Work the claims named on the command line, or every waiting claim."""
    for claim_id in sys.argv[1:] or waiting_claims():
        print(f"{claim_id}: {run(claim_id, f'{claim_id}-{uuid4().hex[:8]}')}")


if __name__ == "__main__":
    main()
