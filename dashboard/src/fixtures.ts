import { vi } from "vitest";
import type {
  Claim,
  ClaimHistory,
  ClaimSummary,
  Handler,
  Policy,
  Step,
} from "./api";

export const summary = (over: Partial<ClaimSummary> = {}): ClaimSummary => ({
  claim_id: "CLM-1001",
  claim_type: "trip_delay",
  customer_name: "Maya Patel",
  summary: "Flight home canceled by the airline",
  amount_claimed: 420,
  submitted_on: "2026-06-24",
  status: "waiting",
  decision: null,
  payout: null,
  paid_amount: null,
  ...over,
});

export const claim = (over: Partial<Claim> = {}): Claim => ({
  ...summary(),
  policy_id: "POL-2001",
  customer_id: "CUS-3001",
  incident_date: "2026-06-18",
  incident_location: "Rome, Italy",
  story:
    "My flight home from Rome was canceled about two hours before departure.",
  items: [
    {
      description: "Airport hotel, one night",
      category: "accommodation",
      amount: 245,
    },
    { description: "Taxis", category: "transport", amount: 175 },
  ],
  documents: [
    {
      name: "Meridian Air cancellation notice",
      type: "carrier_report",
      content: "Flight MA 611 was canceled because of crew availability.",
    },
  ],
  reason: null,
  policy_section: null,
  decided_at: null,
  signed_off_by: null,
  signed_off_at: null,
  paid_at: null,
  ...over,
});

export const policy: Policy = {
  policy_id: "POL-2001",
  plan: { plan: "premium", name: "UnderCover Premium" },
  add_ons: [],
  purchased_on: "2026-04-22",
  sold_through: "Meridian Air checkout",
  trip: {
    destination: "Rome, Italy",
    departs_on: "2026-06-10",
    returns_on: "2026-06-18",
    trip_cost: 3100,
  },
  travelers: ["Maya Patel"],
};

export const history: ClaimHistory = {
  previous_claims: [
    {
      claim_id: "CLM-0412",
      filed_on: "2024-08-19",
      claim_type: "baggage_delay",
      summary: "Checked bag arrived 30 hours late in Lisbon",
      outcome: "approved",
      amount_paid: 140,
    },
  ],
};

export const handlers: Handler[] = [
  {
    handler_id: "HND-01",
    name: "Dana Whitfield",
    role: "Senior Claims Handler",
    can_approve_over_limit: true,
  },
  {
    handler_id: "HND-02",
    name: "Marcus Oyelaran",
    role: "Claims Handler",
    can_approve_over_limit: true,
  },
];

export const step = (over: Partial<Step> = {}): Step => ({
  id: 1,
  kind: "message",
  text: "Run started on thread CLM-1001-ab12",
  created_at: "2026-10-19T12:03:44+00:00",
  ...over,
});

export function claimRoutes(
  over: Partial<Claim> = {},
  steps: Step[] = [],
): Record<string, unknown> {
  const loaded = claim(over);
  return {
    [`/api/claims/${loaded.claim_id}`]: loaded,
    [`/api/claims/${loaded.claim_id}/steps`]: steps,
    [`/api/policies/${loaded.policy_id}`]: policy,
    [`/api/customers/${loaded.customer_id}/claim-history`]: history,
    "/api/handlers": handlers,
  };
}

export function stubApi(routes: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      Promise.resolve(
        path in routes
          ? new Response(JSON.stringify(routes[path]))
          : new Response("{}", { status: 404 }),
      ),
    ),
  );
}
