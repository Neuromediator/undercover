# Status

The pilot is being built in the phases of `docs/PLAN.md`. Done so far: phase 1.

## What is built

- `backend/`: FastAPI and SQLite. The database is `backend/undercover.db` (or the path in `UNDERCOVER_DB`). It is built from `data/` on the first start. Customers keep only their name and claim history.
  - `GET /api/claims`, `GET /api/claims/{claim_id}`
  - `GET /api/policies/{policy_id}`, `GET /api/customers/{customer_id}/claim-history`
  - `GET /api/policy-wording`, `GET /api/handlers`, `GET /api/health`
- `agent/`: still the hello-world entry point `run(claim_id, thread_id)`.
- `dashboard/`: still one page that shows whether the backend is up.
- `e2e/`: one test of that page.

## How to run it

- `npm run dev` starts the backend on port 8000 and the dashboard on port 5173.
- `uv run -m backend.seed` rebuilds the database, which gives a fresh queue of 25 waiting claims.
- `npm run check` runs every check.
