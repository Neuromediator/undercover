import { expect, it } from "vitest";
import {
  addOnLabel,
  formatDate,
  formatTime,
  humanize,
  money,
  outcomeLabel,
  paymentOf,
  preview,
  stageLabel,
} from "./format";
import { summary } from "./fixtures";

it("writes money in US dollars", () => {
  expect(money(1250)).toBe("$1,250.00");
  expect(money(0.5)).toBe("$0.50");
});

it("labels stages and outcomes in plain words", () => {
  expect(stageLabel("awaiting_signoff")).toBe("Waiting for sign-off");
  expect(stageLabel("in_progress")).toBe("In progress");
  expect(outcomeLabel("approve")).toBe("Approved");
  expect(outcomeLabel("decline")).toBe("Declined");
  expect(outcomeLabel("refer")).toBe("Referred");
});

it("turns identifiers into words", () => {
  expect(humanize("trip_delay")).toBe("Trip delay");
  expect(addOnLabel("pre_existing_waiver")).toBe(
    "Pre-Existing Condition Waiver",
  );
  expect(addOnLabel("new_add_on")).toBe("New add on");
});

it("says where a payment stands", () => {
  expect(paymentOf(summary())).toBeNull();
  expect(paymentOf(summary({ decision: "decline" }))).toBeNull();
  const approved = summary({ decision: "approve", payout: 420 });
  expect(paymentOf({ ...approved, status: "decided" })).toBe("pending");
  expect(paymentOf({ ...approved, status: "awaiting_signoff" })).toBe(
    "on-hold",
  );
  expect(paymentOf({ ...approved, paid_amount: 420 })).toBe("paid");
});

it("formats dates and times", () => {
  expect(formatDate("2026-06-18")).toBe("Jun 18, 2026");
  expect(formatTime("2026-10-19T12:03:44+00:00")).toMatch(/^Oct (19|20), /);
});

it("shortens text to one line", () => {
  expect(preview("a\n  b")).toBe("a b");
  expect(preview("x".repeat(100), 10)).toBe("xxxxxxxxxx...");
});
