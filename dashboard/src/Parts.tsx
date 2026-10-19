import type { ClaimSummary, Stage } from "./api";
import { PAYMENT_LABELS, outcomeLabel, paymentOf, stageLabel } from "./format";

export function StageChip({ stage }: Readonly<{ stage: Stage }>) {
  return <span className={`chip chip-${stage}`}>{stageLabel(stage)}</span>;
}

export function OutcomeLabel({ claim }: Readonly<{ claim: ClaimSummary }>) {
  if (!claim.decision) return <span className="muted">-</span>;
  return (
    <span className={`outcome outcome-${claim.decision}`}>
      {outcomeLabel(claim.decision)}
    </span>
  );
}

export function PaymentLabel({ claim }: Readonly<{ claim: ClaimSummary }>) {
  const payment = paymentOf(claim);
  if (!payment) return <span className="muted">-</span>;
  return (
    <span className={`payment payment-${payment}`}>
      {PAYMENT_LABELS[payment]}
    </span>
  );
}

export function Notice({ children }: Readonly<{ children: string }>) {
  return (
    <p className="alert" role="alert">
      {children}
    </p>
  );
}
