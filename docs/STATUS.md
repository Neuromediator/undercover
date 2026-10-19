# Status

The pilot is built: all six phases of `docs/PLAN.md` are done.

## What is built

- `backend/`: FastAPI and SQLite. The database is `backend/undercover.db` (or the path in `UNDERCOVER_DB`). It is built from `data/` on the first start. Customers keep only their name and claim history. The agent's instructions are `backend/instructions.md`, served read only.
- `agent/`: the UnderCover Agent. `run(claim_id, thread_id)` fetches the instructions from the backend, starts the claim, runs a `create_agent` agent with six tools (`get_claim`, `get_policy`, `get_claim_history`, `get_policy_wording`, `decide_claim`, `pay_claim`) and posts every step to the backend. It reaches the backend only through its API. A refusal from the backend goes back to the model as text.
- `dashboard/`: React, Vite and TypeScript, styled to `docs/BRAND.md` in light and dark. It refreshes every 2 seconds.
  - Queue (`#/`): every claim with its stage, outcome, payout and payment, and a filter by stage with counts.
  - Claim (`#/claims/CLM-1001`): the decision and its reason, what the agent did step by step, the story, items, documents, the policy and the claim history. A payout on hold shows a sign-off form: the handler picks their name and clicks "Sign off and pay".
  - Agent instructions (`#/instructions`): the instructions as plain text, nothing to edit.
- `e2e/`: Playwright tests of the queue, an approval that is paid, a payout held for sign-off and signed off in the browser, the page following the agent live, and the read-only instructions. The test's API calls play the agent, so no model is involved.

## The API

Every operation has an `operation_id`, a one-line docstring and no optional inputs.

| Operation | Route |
|---|---|
| `health` | `GET /api/health` |
| `list_claims` | `GET /api/claims` |
| `get_claim` | `GET /api/claims/{claim_id}` |
| `list_steps` | `GET /api/claims/{claim_id}/steps` |
| `get_policy` | `GET /api/policies/{policy_id}` |
| `get_claim_history` | `GET /api/customers/{customer_id}/claim-history` |
| `get_policy_wording` | `GET /api/policy-wording` |
| `get_instructions` | `GET /api/instructions` |
| `list_handlers` | `GET /api/handlers` |
| `start_claim` | `POST /api/claims/{claim_id}/start` |
| `add_step` | `POST /api/claims/{claim_id}/steps` |
| `decide_claim` | `POST /api/claims/{claim_id}/decision` |
| `pay_claim` | `POST /api/claims/{claim_id}/payment` |
| `sign_off_claim` | `POST /api/claims/{claim_id}/sign-off` |

## The claim workflow

A claim is `waiting`, `in_progress`, `awaiting_signoff` or `decided`. Starting it makes it `in_progress` (starting it again is allowed, which retries a stuck run). Deciding it needs `in_progress`. A decline or a referral is `decided` at once. An approval is `decided` too, unless the payout is over $1,000: then the claim is `awaiting_signoff`.

Paying takes the amount and must match the approved payout. The backend refuses to pay a payout over $1,000 until a handler has signed it off (409, with a message that says so). Signing off records the handler and pays the claim. A payout of exactly $1,000.00 needs no sign-off.

## How to run it

- `npm run dev` starts the backend on port 8000 and the dashboard on port 5173.
- `npm run agent -- CLM-1001 CLM-1002` works those claims. `npm run agent` alone works every waiting claim. The backend must be running, and `OPENROUTER_API_KEY` must be in `.env`. `MODEL_NAME` picks another model.
- `uv run -m backend.seed` rebuilds the database, which gives a fresh queue of 25 waiting claims.
- `npm run check` runs every check. The end-to-end tests use their own backend on port 8100, dashboard on port 5273 and database `e2e/e2e.db`, rebuilt on every run, so they never touch the data you see with `npm run dev`. The Vite proxy reads its target from `API_URL`.

## Things to know

- The agent has been run for real on CLM-1001, CLM-1002, CLM-1003 and CLM-1008. Their decisions were read against the policy wording and agree with it. The agent has not been scored against the handlers' decisions, and `data/evals/` has not been opened.
- A referred claim is `decided` with the outcome `refer`. What a handler does next is outside the pilot.
- If a run crashes, the claim stays `in_progress`. Run it again with `npm run agent -- CLM-xxxx`.
- The agent is started from the command line. The dashboard has no run button.
- The claims manual, sign-in, real payments and messages to customers are not part of the pilot.
