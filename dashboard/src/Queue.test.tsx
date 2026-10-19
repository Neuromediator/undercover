import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { summary, stubApi } from "./fixtures";
import { Queue } from "./Queue";

const CLAIMS = [
  summary(),
  summary({
    claim_id: "CLM-1002",
    customer_name: "Dev Rao",
    status: "in_progress",
  }),
  summary({
    claim_id: "CLM-1003",
    status: "decided",
    decision: "approve",
    payout: 420,
    paid_amount: 420,
  }),
  summary({
    claim_id: "CLM-1004",
    status: "awaiting_signoff",
    decision: "approve",
    payout: 2200,
  }),
  summary({
    claim_id: "CLM-1005",
    status: "decided",
    decision: "refer",
    payout: 0,
  }),
  summary({
    claim_id: "CLM-1006",
    status: "decided",
    decision: "decline",
    payout: 0,
  }),
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const rows = () => screen.getAllByRole("row").slice(1);

it("lists the claims with where each one stands", async () => {
  stubApi({ "/api/claims": CLAIMS });
  render(<Queue />);
  expect(await screen.findByText("CLM-1001")).toBeDefined();
  expect(rows()).toHaveLength(6);
  const table = screen.getByRole("table");
  for (const text of [
    "Waiting",
    "In progress",
    "Waiting for sign-off",
    "Decided",
  ]) {
    expect(table.textContent).toContain(text);
  }
  for (const text of [
    "Approved",
    "Referred",
    "Declined",
    "Paid",
    "On hold",
    "$420.00",
    "$2,200.00",
  ]) {
    expect(table.textContent).toContain(text);
  }
  expect(
    screen.getByRole("link", { name: "CLM-1004" }).getAttribute("href"),
  ).toBe("#/claims/CLM-1004");
});

it("counts the claims at each stage", async () => {
  stubApi({ "/api/claims": CLAIMS });
  render(<Queue />);
  await screen.findByText("CLM-1001");
  const counts = screen
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(counts).toEqual([
    "All 6",
    "Waiting 1",
    "In progress 1",
    "Waiting for sign-off 1",
    "Decided 3",
  ]);
});

it("narrows the table to one stage", async () => {
  stubApi({ "/api/claims": CLAIMS });
  render(<Queue />);
  await screen.findByText("CLM-1001");
  const decided = screen.getByRole("button", { name: /^Decided/ });
  fireEvent.click(decided);
  expect(decided.getAttribute("aria-pressed")).toBe("true");
  expect(rows()).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: /^All/ }));
  expect(rows()).toHaveLength(6);
});

it("says when no claim is at a stage", async () => {
  stubApi({ "/api/claims": [summary()] });
  render(<Queue />);
  await screen.findByText("CLM-1001");
  fireEvent.click(screen.getByRole("button", { name: /^Decided/ }));
  expect(screen.getByText("No claims at this stage.")).toBeDefined();
});

it("says when the queue cannot be loaded", async () => {
  stubApi({});
  render(<Queue />);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Could not load the queue.",
  );
});

it("refreshes by itself, and keeps the claims when the backend goes away", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  stubApi({ "/api/claims": [summary()] });
  render(<Queue />);
  await screen.findByText("Waiting", { selector: ".chip" });

  stubApi({ "/api/claims": [summary({ status: "in_progress" })] });
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(
    await screen.findByText("In progress", { selector: ".chip" }),
  ).toBeDefined();

  stubApi({});
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Lost contact with the backend.",
  );
  expect(screen.getByText("CLM-1001")).toBeDefined();
});
