export type Stage = "waiting" | "in_progress" | "awaiting_signoff" | "decided";
export type Outcome = "approve" | "decline" | "refer";
export type StepKind = "message" | "tool_call" | "tool_result";

export interface ClaimSummary {
  claim_id: string;
  claim_type: string;
  customer_name: string;
  summary: string;
  amount_claimed: number;
  submitted_on: string;
  status: Stage;
  decision: Outcome | null;
  payout: number | null;
  paid_amount: number | null;
}

export interface Item {
  description: string;
  category: string;
  amount: number;
}

export interface ClaimDocument {
  name: string;
  type: string;
  content: string;
}

export interface Claim extends ClaimSummary {
  policy_id: string;
  customer_id: string;
  incident_date: string;
  incident_location: string;
  story: string;
  items: Item[];
  documents: ClaimDocument[];
  reason: string | null;
  policy_section: string | null;
  decided_at: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  paid_at: string | null;
}

export interface Policy {
  policy_id: string;
  plan: { plan: string; name: string };
  add_ons: string[];
  purchased_on: string;
  sold_through: string;
  trip: {
    destination: string;
    departs_on: string;
    returns_on: string;
    trip_cost: number;
  };
  travelers: string[];
}

export interface PreviousClaim {
  claim_id: string;
  filed_on: string;
  claim_type: string;
  summary: string;
  outcome: string;
  amount_paid: number;
}

export interface ClaimHistory {
  previous_claims: PreviousClaim[];
}

export interface Handler {
  handler_id: string;
  name: string;
  role: string;
  can_approve_over_limit: boolean;
}

export interface Step {
  id: number;
  kind: StepKind;
  text: string;
  created_at: string;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${String(response.status)}`);
  return (await response.json()) as T;
}

async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const problem = (await response.json()) as { detail: string };
    throw new Error(problem.detail);
  }
  return (await response.json()) as T;
}

export const getHealth = () => get<Record<string, unknown>>("/api/health");
export const listClaims = () => get<ClaimSummary[]>("/api/claims");
export const getClaim = (claimId: string) =>
  get<Claim>(`/api/claims/${claimId}`);
export const getSteps = (claimId: string) =>
  get<Step[]>(`/api/claims/${claimId}/steps`);
export const getPolicy = (policyId: string) =>
  get<Policy>(`/api/policies/${policyId}`);
export const getClaimHistory = (customerId: string) =>
  get<ClaimHistory>(`/api/customers/${customerId}/claim-history`);
export const getHandlers = () => get<Handler[]>("/api/handlers");
export const getInstructions = () => get<{ text: string }>("/api/instructions");
export const signOff = (claimId: string, handlerId: string) =>
  post<Claim>(`/api/claims/${claimId}/sign-off`, { handler_id: handlerId });
