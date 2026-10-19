import { useState } from "react";
import { listClaims, type ClaimSummary, type Stage } from "./api";
import { STAGES, humanize, money, stageLabel } from "./format";
import { Notice, OutcomeLabel, PaymentLabel, StageChip } from "./Parts";
import { POLL_MS, usePolling } from "./usePolling";

type Filter = Stage | "all";

function Filters(
  props: Readonly<{
    claims: ClaimSummary[];
    filter: Filter;
    onChange: (filter: Filter) => void;
  }>,
) {
  const count = (stage: Stage) =>
    props.claims.filter((claim) => claim.status === stage).length;
  const options: { value: Filter; label: string; total: number }[] = [
    { value: "all", label: "All", total: props.claims.length },
    ...STAGES.map((stage) => ({
      value: stage,
      label: stageLabel(stage),
      total: count(stage),
    })),
  ];
  return (
    <div className="filters" role="group" aria-label="Filter by stage">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="filter"
          aria-pressed={props.filter === option.value}
          onClick={() => {
            props.onChange(option.value);
          }}
        >
          {option.label} <span className="mono">{option.total}</span>
        </button>
      ))}
    </div>
  );
}

function Row({ claim }: Readonly<{ claim: ClaimSummary }>) {
  return (
    <tr>
      <td className="claim-id">
        <a className="mono" href={`#/claims/${claim.claim_id}`}>
          {claim.claim_id}
        </a>
      </td>
      <td>{claim.customer_name}</td>
      <td className="hide-narrow">{humanize(claim.claim_type)}</td>
      <td className="hide-narrow">{claim.summary}</td>
      <td className="num mono hide-narrow">{money(claim.amount_claimed)}</td>
      <td>
        <StageChip stage={claim.status} />
      </td>
      <td>
        <OutcomeLabel claim={claim} />
      </td>
      <td className="num mono hide-narrow">
        {claim.payout === null ? "-" : money(claim.payout)}
      </td>
      <td className="hide-narrow">
        <PaymentLabel claim={claim} />
      </td>
    </tr>
  );
}

export function Queue() {
  const { data: claims, error } = usePolling(listClaims, POLL_MS);
  const [filter, setFilter] = useState<Filter>("all");

  if (!claims) {
    return (
      <>
        <h1>Claims queue</h1>
        {error ? <Notice>Could not load the queue.</Notice> : <p>Loading</p>}
      </>
    );
  }

  const shown =
    filter === "all"
      ? claims
      : claims.filter((claim) => claim.status === filter);
  return (
    <>
      <h1>Claims queue</h1>
      {error && <Notice>Lost contact with the backend.</Notice>}
      <Filters claims={claims} filter={filter} onChange={setFilter} />
      <section className="panel scroll">
        <table>
          <thead>
            <tr>
              <th>Claim</th>
              <th>Customer</th>
              <th className="hide-narrow">Type</th>
              <th className="hide-narrow">Summary</th>
              <th className="num hide-narrow">Claimed</th>
              <th>Stage</th>
              <th>Outcome</th>
              <th className="num hide-narrow">Payout</th>
              <th className="hide-narrow">Payment</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((claim) => (
              <Row key={claim.claim_id} claim={claim} />
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="muted">No claims at this stage.</p>
        )}
      </section>
    </>
  );
}
