import { useCallback } from "react";
import {
  getClaim,
  getClaimHistory,
  getHandlers,
  getPolicy,
  getSteps,
  type Claim,
  type ClaimHistory,
  type Handler,
  type Policy,
  type Step,
} from "./api";
import {
  addOnLabel,
  formatDate,
  formatTime,
  humanize,
  money,
  preview,
} from "./format";
import { Notice, OutcomeLabel, StageChip } from "./Parts";
import { SignOff } from "./SignOff";
import { POLL_MS, usePolling } from "./usePolling";

async function loadClaimPage(claimId: string) {
  const claim = await getClaim(claimId);
  const [steps, policy, history, handlers] = await Promise.all([
    getSteps(claimId),
    getPolicy(claim.policy_id),
    getClaimHistory(claim.customer_id),
    getHandlers(),
  ]);
  return { claim, steps, policy, history, handlers };
}

function Header({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <>
      <h1>
        <span className="mono">{claim.claim_id}</span>{" "}
        <StageChip stage={claim.status} />
      </h1>
      <p className="muted">
        {claim.customer_name}, {humanize(claim.claim_type).toLowerCase()},
        claimed <span className="mono">{money(claim.amount_claimed)}</span>,
        submitted {formatDate(claim.submitted_on)}
      </p>
    </>
  );
}

function PaymentInfo(props: Readonly<{ claim: Claim; handlers: Handler[] }>) {
  const { claim, handlers } = props;
  if (claim.paid_amount !== null && claim.paid_at) {
    const handler = handlers.find((h) => h.handler_id === claim.signed_off_by);
    return (
      <>
        <p>
          Paid <span className="mono">{money(claim.paid_amount)}</span> on{" "}
          {formatTime(claim.paid_at)}.
        </p>
        {claim.signed_off_by && claim.signed_off_at && (
          <p>
            Signed off by {handler?.name ?? claim.signed_off_by} on{" "}
            {formatTime(claim.signed_off_at)}.
          </p>
        )}
      </>
    );
  }
  if (claim.status === "awaiting_signoff") {
    return <p className="hold">Payment on hold until a handler signs off.</p>;
  }
  return <p className="muted">Payment pending.</p>;
}

function noDecisionText(claim: Claim): string {
  return claim.status === "in_progress"
    ? "The agent is working on this claim."
    : "No decision yet.";
}

function Decision(
  props: Readonly<{
    claim: Claim;
    handlers: Handler[];
    onSignedOff: () => void;
  }>,
) {
  const { claim, handlers, onSignedOff } = props;
  return (
    <section className="panel">
      <h2>Decision</h2>
      {claim.decision === null || claim.payout === null ? (
        <p className="muted">{noDecisionText(claim)}</p>
      ) : (
        <>
          <p>
            <OutcomeLabel claim={claim} />
            {claim.decision === "approve" && (
              <>
                {" "}
                <span className="mono">{money(claim.payout)}</span>
              </>
            )}
          </p>
          <p className="reason">{claim.reason}</p>
          <p className="muted">Policy section: {claim.policy_section}</p>
          {claim.decision === "approve" && (
            <PaymentInfo claim={claim} handlers={handlers} />
          )}
          {claim.status === "awaiting_signoff" && (
            <SignOff
              claim={claim}
              handlers={handlers}
              onSignedOff={onSignedOff}
            />
          )}
        </>
      )}
    </section>
  );
}

function StepRow({ step }: Readonly<{ step: Step }>) {
  return (
    <li className="step">
      <time className="muted" dateTime={step.created_at}>
        {formatTime(step.created_at)}
      </time>
      {step.kind === "tool_result" ? (
        <details>
          <summary className="mono">{preview(step.text)}</summary>
          <pre>{step.text}</pre>
        </details>
      ) : (
        <p className={step.kind === "tool_call" ? "mono" : undefined}>
          {step.text}
        </p>
      )}
    </li>
  );
}

function Activity({ claim, steps }: Readonly<{ claim: Claim; steps: Step[] }>) {
  return (
    <section className="panel">
      <h2>What the agent did</h2>
      {claim.status === "in_progress" && (
        <p className="muted">
          The agent is working. This list updates by itself.
        </p>
      )}
      {steps.length === 0 ? (
        <p className="muted">The agent has not worked on this claim.</p>
      ) : (
        <ol className="steps">
          {steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Story({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <section className="panel">
      <h2>The claim</h2>
      <p>
        <strong>{claim.summary}</strong>
      </p>
      <p>{claim.story}</p>
      <p className="muted">
        Incident: {formatDate(claim.incident_date)}, {claim.incident_location}
      </p>
    </section>
  );
}

function Items({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <section className="panel scroll">
      <h2>Items claimed</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th className="hide-narrow">Category</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {claim.items.map((item) => (
            <tr key={item.description}>
              <td>{item.description}</td>
              <td className="hide-narrow">{humanize(item.category)}</td>
              <td className="num mono">{money(item.amount)}</td>
            </tr>
          ))}
          <tr>
            <th colSpan={2}>Total claimed</th>
            <td className="num mono">{money(claim.amount_claimed)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function Documents({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <section className="panel">
      <h2>Documents</h2>
      {claim.documents.map((document) => (
        <article key={document.name} className="document">
          <h3>{document.name}</h3>
          <p className="muted">{humanize(document.type)}</p>
          <p>{document.content}</p>
        </article>
      ))}
    </section>
  );
}

function PolicyPanel({ policy }: Readonly<{ policy: Policy }>) {
  const { trip } = policy;
  return (
    <section className="panel">
      <h2>Policy</h2>
      <dl>
        <dt>Policy</dt>
        <dd className="mono">{policy.policy_id}</dd>
        <dt>Plan</dt>
        <dd>{policy.plan.name}</dd>
        <dt>Add-ons</dt>
        <dd>
          {policy.add_ons.length === 0
            ? "None"
            : policy.add_ons.map(addOnLabel).join(", ")}
        </dd>
        <dt>Trip</dt>
        <dd>{trip.destination}</dd>
        <dt>Dates</dt>
        <dd>
          {formatDate(trip.departs_on)} to {formatDate(trip.returns_on)}
        </dd>
        <dt>Trip cost</dt>
        <dd className="mono">{money(trip.trip_cost)}</dd>
        <dt>Travelers</dt>
        <dd>{policy.travelers.join(", ")}</dd>
        <dt>Bought</dt>
        <dd>{formatDate(policy.purchased_on)}</dd>
      </dl>
    </section>
  );
}

function History({ history }: Readonly<{ history: ClaimHistory }>) {
  return (
    <section className="panel">
      <h2>Claim history</h2>
      {history.previous_claims.length === 0 ? (
        <p className="muted">No earlier claims.</p>
      ) : (
        <ul className="history">
          {history.previous_claims.map((earlier) => (
            <li key={earlier.claim_id}>
              <span className="mono">{earlier.claim_id}</span>,{" "}
              {formatDate(earlier.filed_on)}: {earlier.summary}.{" "}
              {humanize(earlier.outcome)}, paid{" "}
              <span className="mono">{money(earlier.amount_paid)}</span>.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ClaimPage({ claimId }: Readonly<{ claimId: string }>) {
  const load = useCallback(() => loadClaimPage(claimId), [claimId]);
  const { data, error, reload } = usePolling(load, POLL_MS);

  if (!data) {
    return (
      <>
        <a href="#/">Back to the queue</a>
        {error ? (
          <Notice>{`Could not load claim ${claimId}.`}</Notice>
        ) : (
          <p>Loading</p>
        )}
      </>
    );
  }

  const { claim, steps, policy, history, handlers } = data;
  return (
    <>
      <a href="#/">Back to the queue</a>
      <Header claim={claim} />
      {error && <Notice>Lost contact with the backend.</Notice>}
      <div className="layout">
        <div>
          <Decision claim={claim} handlers={handlers} onSignedOff={reload} />
          <Activity claim={claim} steps={steps} />
          <Story claim={claim} />
          <Items claim={claim} />
          <Documents claim={claim} />
        </div>
        <div>
          <PolicyPanel policy={policy} />
          <History history={history} />
        </div>
      </div>
    </>
  );
}
