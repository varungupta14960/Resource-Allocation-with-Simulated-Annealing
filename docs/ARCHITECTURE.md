# Architecture
* `backend/app/core` – `Problem` (utility, energy, penalty, feasibility), `metrics` (gap, statistics), `datasets`.
* `backend/app/algorithms` – `simulated_annealing` (generator-based, shared by batch/stream/experiments), `neighbourhood`, `construction`, `baselines`, `exact`.
* `backend/app/experiments/runner.py` – method comparison, N-run experiment, α×T₀ sweep.
* `backend/app/models/schemas.py` – Pydantic request/response models (OpenAPI at `/docs`).
* `backend/app/api/routes.py` – endpoints: `/api/datasets`, `/api/problem/validate`, `/api/sa/run`, `/api/sa/stream` (SSE), `/api/compare`, `/api/exact`, `/api/experiments/run`, `/api/sensitivity/run`.
* `frontend/` – Next.js App Router pages (one per section), `lib/` (typed API client, store, narrative generator, pipeline), `components/` (charts, tables, formula tooltips).
* `tests/` – 50 pytest tests incl. independent brute-force verification of the exact solver.
