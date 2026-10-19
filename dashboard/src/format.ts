import type { ClaimSummary, Outcome, Stage } from "./api";

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const money = (amount: number): string => dollars.format(amount);

export const STAGES: Stage[] = [
  "waiting",
  "in_progress",
  "awaiting_signoff",
  "decided",
];

const STAGE_LABELS: Record<Stage, string> = {
  waiting: "Waiting",
  in_progress: "In progress",
  awaiting_signoff: "Waiting for sign-off",
  decided: "Decided",
};

const OUTCOME_LABELS: Record<Outcome, string> = {
  approve: "Approved",
  decline: "Declined",
  refer: "Referred",
};

const ADD_ON_LABELS: Record<string, string> = {
  adventure_sports: "Adventure Sports",
  pre_existing_waiver: "Pre-Existing Condition Waiver",
  electronics_plus: "Electronics Plus",
};

export const stageLabel = (stage: Stage): string => STAGE_LABELS[stage];

export const outcomeLabel = (decision: Outcome): string =>
  OUTCOME_LABELS[decision];

export const addOnLabel = (addOn: string): string =>
  ADD_ON_LABELS[addOn] ?? humanize(addOn);

export function humanize(value: string): string {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type Payment = "paid" | "on-hold" | "pending";

export function paymentOf(claim: ClaimSummary): Payment | null {
  if (claim.decision !== "approve") return null;
  if (claim.paid_amount !== null) return "paid";
  return claim.status === "awaiting_signoff" ? "on-hold" : "pending";
}

export const PAYMENT_LABELS: Record<Payment, string> = {
  paid: "Paid",
  "on-hold": "On hold",
  pending: "Pending",
};

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

export function preview(text: string, length = 90): string {
  const line = text.replaceAll(/\s+/g, " ").trim();
  return line.length > length ? `${line.slice(0, length)}...` : line;
}
