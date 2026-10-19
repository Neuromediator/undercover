import { expect, test, type APIRequestContext } from "@playwright/test";

// The tests change claims and run in order, each on claims of its own.
test.describe.configure({ mode: "serial" });

const THREAD = "e2e";

async function post(request: APIRequestContext, path: string, data: object) {
  return request.post(`/api/claims/${path}`, { data });
}

// What the agent does first: start the claim and take a step.
async function startWork(request: APIRequestContext, claimId: string) {
  const started = await post(request, `${claimId}/start`, {
    thread_id: THREAD,
  });
  expect(started.ok()).toBe(true);
  const step = await post(request, `${claimId}/steps`, {
    thread_id: THREAD,
    kind: "tool_call",
    text: `get_claim(claim_id='${claimId}')`,
  });
  expect(step.ok()).toBe(true);
}

async function decide(
  request: APIRequestContext,
  claimId: string,
  decision: "approve" | "decline",
  payout: number,
  reason: string,
) {
  const decided = await post(request, `${claimId}/decision`, {
    decision,
    payout,
    reason,
    policy_section: "Section 3, Trip Delay",
  });
  expect(decided.ok()).toBe(true);
}

test("the queue lists the 25 claims, all waiting", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Claims queue" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await expect(page.getByRole("button", { name: "Waiting 25" })).toBeVisible();
});

test("an approval up to $1,000 is paid and shows as decided", async ({
  page,
  request,
}) => {
  await startWork(request, "CLM-1001");
  await decide(
    request,
    "CLM-1001",
    "approve",
    420,
    "The delay was long enough and the receipts are in order.",
  );
  const payment = await post(request, "CLM-1001/payment", { amount: 420 });
  expect(payment.ok()).toBe(true);

  await page.goto("/#/claims/CLM-1001");
  await expect(page.getByRole("heading", { name: /CLM-1001/ })).toContainText(
    "Decided",
  );
  await expect(
    page.getByText("The delay was long enough and the receipts are in order."),
  ).toBeVisible();
  await expect(
    page.getByText("Policy section: Section 3, Trip Delay"),
  ).toBeVisible();
  await expect(page.getByText("Paid $420.00")).toBeVisible();

  await page.goto("/");
  const row = page.getByRole("row", { name: /CLM-1001/ });
  await expect(row).toContainText("Approved");
  await expect(row).toContainText("Paid");
});

test("a payout over $1,000 is held until a handler signs off", async ({
  page,
  request,
}) => {
  await startWork(request, "CLM-1008");
  await decide(
    request,
    "CLM-1008",
    "approve",
    2200,
    "The trip had to be canceled.",
  );

  const refused = await post(request, "CLM-1008/payment", { amount: 2200 });
  expect(refused.status()).toBe(409);
  const problem = (await refused.json()) as { detail: string };
  expect(problem.detail).toContain("sign-off");

  await page.goto("/");
  await page.getByRole("button", { name: /^Waiting for sign-off/ }).click();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("CLM-1008");
  await expect(rows.first()).toContainText("On hold");

  await page.goto("/#/claims/CLM-1008");
  const heading = page.getByRole("heading", { name: /CLM-1008/ });
  await expect(heading).toContainText("Waiting for sign-off");
  await expect(
    page.getByText("Payment on hold until a handler signs off."),
  ).toBeVisible();
  await page
    .getByLabel("Signing off")
    .selectOption({ label: "Dana Whitfield" });
  await page
    .getByRole("button", { name: "Sign off and pay $2,200.00" })
    .click();

  await expect(page.getByText("Paid $2,200.00")).toBeVisible();
  await expect(page.getByText(/Signed off by Dana Whitfield/)).toBeVisible();
  await expect(heading).toContainText("Decided");
  const claim = (await (await request.get("/api/claims/CLM-1008")).json()) as {
    paid_amount: number;
    signed_off_by: string;
  };
  expect(claim).toMatchObject({ paid_amount: 2200, signed_off_by: "HND-01" });
});

test("the claim page follows the agent without a reload", async ({
  page,
  request,
}) => {
  await page.goto("/#/claims/CLM-1002");
  const heading = page.getByRole("heading", { name: /CLM-1002/ });
  await expect(heading).toContainText("Waiting");

  await startWork(request, "CLM-1002");
  await expect(heading).toContainText("In progress");
  await expect(page.getByText("get_claim(claim_id='CLM-1002')")).toBeVisible();

  await decide(request, "CLM-1002", "decline", 0, "The wording excludes it.");
  await expect(heading).toContainText("Decided");
  await expect(page.locator(".outcome")).toHaveText("Declined");
  await expect(page.getByText("The wording excludes it.")).toBeVisible();
});

test("the instructions can be read and not changed", async ({ page }) => {
  await page.goto("/#/instructions");
  await expect(
    page.getByRole("heading", { name: "Agent instructions" }),
  ).toBeVisible();
  await expect(page.getByText("# The UnderCover Agent")).toBeVisible();
  await expect(
    page.locator("main").locator("textarea, input, button, [contenteditable]"),
  ).toHaveCount(0);
});
