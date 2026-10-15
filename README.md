# PBL-13 · Resource Allocation Using Simulated Annealing

Woxsen University · FOAI · Final Project Review (Review 2).
A working full-stack application: the optimisation engine (Simulated Annealing, baselines, exact solver, experiments) runs in **Python/FastAPI**; the dashboard is **Next.js + React + TypeScript + Tailwind + Recharts**. Nothing is hard-coded: every number on screen is computed by the backend, and every experiment is reproducible through a seed.

```
Frontend (Next.js)  ->  REST/SSE API (FastAPI)  ->  Optimisation engine  ->  Algorithms  ->  Results
frontend/               backend/app/api            backend/app/experiments   backend/app/algorithms
                        backend/app/models         backend/app/core (model, metrics, datasets)
```

## 1. Install
Requirements: Python 3.10+ and Node.js 20+.

```bash
# backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# frontend (new terminal)
cd frontend
npm install
```

## 2. Run
```bash
# terminal 1 - backend (http://localhost:8000, docs at /docs)
cd backend && uvicorn app.main:app --port 8000

# terminal 2 - frontend (http://localhost:3000)
cd frontend && cp .env.example .env.local && npm run dev
```
Open http://localhost:3000. API documentation (OpenAPI): http://localhost:8000/docs. No login, no paid services.

## 3. Tests
```bash
# from the project root, with the backend venv active
python -m pytest -q          # 50 tests: utility, energy, feasibility, neighbours, acceptance, baselines, exact, gap, API
```

## 4. Production build
```bash
cd frontend && npm run build && npm start        # serves on :3000
cd backend  && uvicorn app.main:app --port 8000  # no --reload
```
If the backend is not on localhost:8000, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` and add the frontend origin to `CORS_ORIGINS`.

## 5. Using the app
* **Load example dataset**: *Problem Setup* → choose `toy`, `small`, `medium`, `large`, or generate a custom size (n projects × m resources, seed).
* **One-click demo**: *Professor Demo Mode* (or *Run Demonstration* on the Overview) runs validate → SA → baselines → exact (if small) → 30 runs → sensitivity → generated summary.
* **Run experiments**: *Experiments* page (default 30 runs, seeds = base seed + run index). CSV download included.
* **Reports**: *Results & Analysis* → Print / Save as PDF; CSV downloads on Comparison, Experiments, Sensitivity.

## 6. Datasets (`data/datasets/*.json`, exported by `scripts/export_datasets.py`)
| id | n × m | purpose |
|---|---|---|
| toy | 4 × 2 | Review-1 worked example (x=(3,0,4,2) → U=83.49) |
| small | 5 × 2 | exhaustive validation (90,000 raw candidates) |
| medium | 12 × 3 | SA demonstration (search space ≈ 2.8×10¹¹) |
| large | 40 × 5 | seeded synthetic portfolio (seed 2026, capacity = 30 % of max demand) |

## 7. Method summary
* Model: `x_j ∈ {0} ∪ [L_j, U_j]`, `u_j = v_j(1−e^{−k_j x_j})`, `Σ_j a_ij x_j ≤ R_i`, `E = −U + λ Σ_i max(0,(usage_i−R_i)/R_i)`.
* SA (`backend/app/algorithms/simulated_annealing.py`): random feasible start (activation prob 0.5) → neighbour (transfer 50 % / adjust 35 % / toggle 15 %, snapping keeps every neighbour in the viability domain) → ΔE → accept if ΔE ≤ 0 else with `exp(−ΔE/T)` → best **feasible** state tracked → `T←αT` while `T>Tmin`. Initial test values (not claimed optimal): T₀=50, α=0.95, Tmin=0.01, chain=100, λ=10·max v_j.
* Baselines: equal allocation (largest common level that fits), greedy (best utility gain per normalised resource cost), random-feasible (best of N, N = SA's evaluations by default), exact (pruned exhaustive search, refused above 2,000,000 raw candidates).
* Gap = (U_exact − U_method)/U_exact × 100, only when the exact optimum was really computed; otherwise “Exact optimum not computed for this instance.”

See `docs/` for the demo script, likely professor questions, and troubleshooting.
