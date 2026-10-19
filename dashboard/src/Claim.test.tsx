import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClaimPage } from "./Claim";
import { claimRoutes, history, policy, step, stubApi } from "./fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const text = () => document.body.textContent;

async function show(over = {}, steps = [step()]) {
  stubApi(claimRoutes(over, steps));
  render(<ClaimPage claimId="CLM-1001" />);
  await screen.findByRole("heading", { name: /CLM-1001/ });
}

it("shows the claim in full before a decision", async () => {
  await show();
  expect(text()).toContain("Maya Patel, trip delay, claimed $420.00");
  expect(screen.getByText("Waiting", { selector: ".chip" })).toBeDefined();
  expect(text()).toContain("No decision yet.");
  expect(text()).toContain("My flight home from Rome was canceled");
  expect(text()).toContain("Incident: Jun 18, 2026, Rome, Italy");
  expect(screen.getByText("Airport hotel, one night")).toBeDefined();
  expect(screen.getByText("Accommodation")).toBeDefined();
  expect(text()).toContain("Total claimed$420.00");
  expect(screen.getByText("Meridian Air cancellation notice")).toBeDefined();
  expect(screen.getByText("Carrier report")).toBeDefined();
  expect(text()).toContain(
    "Flight MA 611 was canceled because of crew availability.",
  );
});

it("shows the policy and the claim history", async () => {
  await show();
  expect(text()).toContain(policy.plan.name);
  expect(text()).toContain("Jun 10, 2026 to Jun 18, 2026");
  expect(text()).toContain("$3,100.00");
  expect(screen.getByText("None")).toBeDefined();
  expect(text()).toContain(
    "CLM-0412, Aug 19, 2024: Checked bag arrived 30 hours late in Lisbon.",
  );
  expect(text()).toContain("Approved, paid $140.00.");
});

it("lists add-ons and says when there is no history", async () => {
  stubApi({
    ...claimRoutes(),
    "/api/policies/POL-2001": {
      ...policy,
      add_ons: ["electronics_plus", "adventure_sports"],
    },
    "/api/customers/CUS-3001/claim-history": {
      ...history,
      previous_claims: [],
    },
  });
  render(<ClaimPage claimId="CLM-1001" />);
  await screen.findByText("Electronics Plus, Adventure Sports");
  expect(screen.getByText("No earlier claims.")).toBeDefined();
});

it("shows what the agent did, with each result folded away", async () => {
  await show({ status: "in_progress" }, [
    step({ id: 1 }),
    step({ id: 2, kind: "tool_call", text: "get_claim(claim_id='CLM-1001')" }),
    step({
      id: 3,
      kind: "tool_result",
      text: `get_claim: {"claim_id":"CLM-1001"}\n${"x".repeat(200)}`,
    }),
  ]);
  expect(text()).toContain("The agent is working on this claim.");
  expect(text()).toContain(
    "The agent is working. This list updates by itself.",
  );
  expect(screen.getByText("Run started on thread CLM-1001-ab12")).toBeDefined();
  expect(screen.getByText("get_claim(claim_id='CLM-1001')").className).toBe(
    "mono",
  );
  const summary = screen.getByText(
    /^get_claim: \{"claim_id":"CLM-1001"\} x+\.\.\.$/,
  );
  expect(
    summary.closest("details")?.querySelector("pre")?.textContent,
  ).toContain("x".repeat(200));
});

it("says when the agent has not worked on the claim", async () => {
  await show({}, []);
  expect(
    screen.getByText("The agent has not worked on this claim."),
  ).toBeDefined();
});

it("shows an approval that has been paid", async () => {
  await show({
    status: "decided",
    decision: "approve",
    payout: 420,
    reason: "The delay was long enough and the receipts are in order.",
    policy_section: "Section 3, Trip Delay",
    paid_amount: 420,
    paid_at: "2026-10-19T12:03:44+00:00",
  });
  expect(screen.getByText("Approved")).toBeDefined();
  expect(
    screen.getByText(
      "The delay was long enough and the receipts are in order.",
    ),
  ).toBeDefined();
  expect(text()).toContain("Policy section: Section 3, Trip Delay");
  expect(text()).toMatch(/Paid \$420\.00 on Oct (19|20)/);
  expect(text()).not.toContain("Signed off");
});

it("shows who signed off a held payout", async () => {
  await show({
    status: "decided",
    decision: "approve",
    payout: 2200,
    paid_amount: 2200,
    paid_at: "2026-10-19T12:10:00+00:00",
    signed_off_by: "HND-01",
    signed_off_at: "2026-10-19T12:09:00+00:00",
  });
  expect(text()).toContain("Paid $2,200.00");
  expect(text()).toMatch(/Signed off by Dana Whitfield on Oct (19|20)/);
});

it("falls back to the handler's id", async () => {
  await show({
    status: "decided",
    decision: "approve",
    payout: 2200,
    paid_amount: 2200,
    paid_at: "2026-10-19T12:10:00+00:00",
    signed_off_by: "HND-99",
    signed_off_at: "2026-10-19T12:09:00+00:00",
  });
  expect(text()).toContain("Signed off by HND-99");
});

it("says the payment is on hold until a handler signs off", async () => {
  await show({ status: "awaiting_signoff", decision: "approve", payout: 2200 });
  expect(
    screen.getByText("Waiting for sign-off", { selector: ".chip" }),
  ).toBeDefined();
  expect(
    screen.getByText("Payment on hold until a handler signs off."),
  ).toBeDefined();
});

it("says when an approval is not paid yet", async () => {
  await show({ status: "decided", decision: "approve", payout: 420 });
  expect(screen.getByText("Payment pending.")).toBeDefined();
});

it("shows a decline with no payment", async () => {
  await show({
    status: "decided",
    decision: "decline",
    payout: 0,
    reason: "The wording excludes it.",
    policy_section: "Section 9, General exclusions",
  });
  expect(screen.getByText("Declined")).toBeDefined();
  expect(text()).not.toContain("Payment");
});

it("says when the claim cannot be loaded", async () => {
  stubApi({});
  render(<ClaimPage claimId="CLM-1001" />);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Could not load claim CLM-1001.",
  );
  expect(screen.getByRole("link", { name: "Back to the queue" })).toBeDefined();
});

it("follows the agent without a reload", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  await show({ status: "in_progress" }, []);
  expect(screen.getByText("In progress", { selector: ".chip" })).toBeDefined();

  stubApi(
    claimRoutes(
      {
        status: "decided",
        decision: "decline",
        payout: 0,
        reason: "Excluded.",
      },
      [step({ kind: "tool_call", text: "decide_claim()" })],
    ),
  );
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(
    await screen.findByText("Decided", { selector: ".chip" }),
  ).toBeDefined();
  expect(screen.getByText("decide_claim()")).toBeDefined();

  stubApi({});
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Lost contact with the backend.",
  );
});
