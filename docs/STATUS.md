# Status

The pilot is being built in the phases of `docs/PLAN.md`. Done so far: phases 1 to 4.

## What is built

- `backend/`: FastAPI and SQLite. The database is `backend/undercover.db` (or the path in `UNDERCOVER_DB`). It is built from `data/` on the first start. Customers keep only their name and claim history.
  - Records: `GET /api/claims`, `GET /api/claims/{claim_id}`, `GET /api/policies/{policy_id}`, `GET /api/customers/{customer_id}/claim-history`, `GET /api/policy-wording`, `GET /api/instructions`, `GET /api/handlers`, `GET /api/health`
  - Workflow: `POST /api/claims/{claim_id}/start`, `GET` and `POST /api/claims/{claim_id}/steps`, `POST .../decision`, `POST .../payment`, `POST .../sign-off`
  - The agent's instructions are `backend/instructions.md`, served read only.
- `agent/`: the UnderCover Agent. `run(claim_id, thread_id)` fetches the instructions from the backend, starts the claim, runs a `create_agent` agent with six tools (`get_claim`, `get_policy`, `get_claim_history`, `get_policy_wording`, `decide_claim`, `pay_claim`) and posts every step to the backend. It reaches the backend only through its API. A refusal from the backend goes back to the model as text.
- `dashboard/`: React, Vite and TypeScript, styled to `docs/BRAND.md` in light and dark. Read only for now, and it refreshes every 2 seconds.
  - Queue (`#/`): every claim with its stage, outcome, payout and payment, and a filter by stage with counts.
  - Claim (`#/claims/CLM-1001`): the decision and its reason, what the agent did step by step, the story, items, documents, the policy and the claim history.
  - Agent instructions (`#/instructions`): the instructions as plain text, nothing to edit.
  - `src/api.ts` has the types and one fetch per operation. Helpers and hooks are `.ts` files, components are `.tsx`. `src/fixtures.ts` is for the tests.
- `e2e/`: one test of the health text. The sign-off and the end-to-end tests come in phase 5.

## The claim workflow

A claim is `waiting`, `in_progress`, `awaiting_signoff` or `decided`. Starting it makes it `in_progress` (starting it again is allowed, which retries a stuck run). Deciding it needs `in_progress`. A decline or a referral is `decided` at once. An approval is `decided` too, unless the payout is over $1,000: then the claim is `awaiting_signoff`.

Paying takes the amount and must match the approved payout. The backend refuses to pay a payout over $1,000 until a handler has signed it off (409, with a message that says so). Signing off records the handler and pays the claim. A payout of exactly $1,000.00 needs no sign-off.

## How to run it

- `npm run dev` starts the backend on port 8000 and the dashboard on port 5173.
- `npm run agent -- CLM-1001 CLM-1002` works those claims. `npm run agent` alone works every waiting claim. The backend must be running, and `OPENROUTER_API_KEY` must be in `.env`. `MODEL_NAME` picks another model.
- `uv run -m backend.seed` rebuilds the database, which gives a fresh queue of 25 waiting claims.
- `npm run check` runs every check.
