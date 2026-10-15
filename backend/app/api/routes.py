"""HTTP API.  Thin layer: validation (Pydantic) -> optimisation engine -> typed results."""
from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..algorithms.exact import ExactTooLarge, exact_status, solve_exact
from ..algorithms.simulated_annealing import SimulatedAnnealing, run_sa
from ..config import EXACT_MAX_SPACE, TOL
from ..core.datasets import DATASETS, RESOURCE_LIBRARY, generate_instance, get_dataset, problem_from_dict
from ..experiments.runner import compare_methods, run_experiment, run_sensitivity
from ..models.schemas import (CompareOut, CompareRequest, ExactRequest, ExactResponse, ExperimentRequest,
                              ProblemIn, SARunOut, SARunRequest, SAStreamRequest, SensitivityRequest)

router = APIRouter(prefix="/api")


@router.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "exact_max_space": EXACT_MAX_SPACE}


# ----------------------------------------------------------------------------- datasets & validation
def _meta(ds_id: str) -> dict:
    d = get_dataset(ds_id)
    p = problem_from_dict(d)
    st = exact_status(p)
    return {"id": ds_id, "name": d["name"], "role": DATASETS[ds_id]["role"],
            "description": DATASETS[ds_id]["description"], "n_projects": p.n, "n_resources": p.m,
            "search_space": st["search_space"], "search_space_log10": st["search_space_log10"],
            "exact_feasible": st["allowed"]}


@router.get("/datasets", tags=["datasets"])
def list_datasets() -> list[dict]:
    return [_meta(i) for i in DATASETS]


@router.get("/datasets/generate", tags=["datasets"])
def generate(n_projects: int = Query(15, ge=1, le=200), n_resources: int = Query(3, ge=1, le=len(RESOURCE_LIBRARY)),
             seed: int = Query(1, ge=0), tightness: float = Query(0.30, gt=0.05, le=1.0)) -> dict:
    """Seeded synthetic portfolio of arbitrary size (same seed -> same instance)."""
    return generate_instance(n_projects, n_resources, seed, tightness)


@router.get("/datasets/{dataset_id}", tags=["datasets"])
def dataset(dataset_id: str) -> dict:
    if dataset_id not in DATASETS:
        raise HTTPException(404, f"Unknown dataset '{dataset_id}'.")
    return {"meta": _meta(dataset_id), "problem": get_dataset(dataset_id)}


@router.post("/problem/validate", tags=["problem"])
def validate(problem: ProblemIn) -> dict:
    """Structural errors are returned as HTTP 422; this adds model-level feasibility diagnostics."""
    p = problem.to_problem()
    errors, warnings = [], []
    usable = [j for j in range(p.n) if all(p.A[i][j] * p.L[j] <= p.R[i] + TOL for i in range(p.m))]
    for j in range(p.n):
        if j not in usable:
            bad = [p.resource_names[i] for i in range(p.m) if p.A[i][j] * p.L[j] > p.R[i] + TOL]
            warnings.append(f"Project '{p.project_names[j]}' can never be activated: its minimum allocation exceeds "
                            f"the capacity of {', '.join(bad)}.")
    if not usable:
        errors.append("No project can be activated: a feasible non-trivial initial allocation does not exist.")
    min_use = [sum(p.A[i][j] * p.L[j] for j in range(p.n)) for i in range(p.m)]
    over = [p.resource_names[i] for i in range(p.m) if min_use[i] > p.R[i] + TOL]
    if over:
        warnings.append("Not all projects can be funded at their minimum simultaneously "
                        f"(minimum demand exceeds {', '.join(over)}); some projects will stay at 0 (as intended).")
    max_use = [sum(p.A[i][j] * p.U[j] for j in range(p.n)) for i in range(p.m)]
    if all(max_use[i] <= p.R[i] + TOL for i in range(p.m)):
        warnings.append("Capacities exceed total maximum demand: constraints are not binding and the trivial "
                        "solution x = U is optimal.")
    st = exact_status(p)
    return {"valid": not errors, "errors": errors, "warnings": warnings,
            "default_lambda": p.default_penalty(), "exact": st,
            "min_demand_ratio": [min_use[i] / p.R[i] for i in range(p.m)],
            "max_demand_ratio": [max_use[i] / p.R[i] for i in range(p.m)]}


# ----------------------------------------------------------------------------- simulated annealing
@router.post("/sa/run", response_model=SARunOut, tags=["simulated-annealing"])
def sa_run(req: SARunRequest) -> Any:
    problem = req.problem.to_problem()
    st = exact_status(problem)
    exact_u = solve_exact(problem)["utility"] if st["allowed"] else None
    return run_sa(problem, req.params.to_params(), exact_u)


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


@router.post("/sa/stream", tags=["simulated-annealing"])
async def sa_stream(req: SAStreamRequest) -> StreamingResponse:
    """Server-Sent Events: one event per temperature level while SA is really executing.
    Aborting the HTTP request (STOP button) cancels the generator and therefore the run."""
    problem = req.problem.to_problem()
    sa = SimulatedAnnealing(problem, req.params.to_params())

    async def gen():
        try:
            yield _sse({"type": "start", "total_levels": sa.total_levels, "lam": sa.lam,
                        "initial_allocation": sa.initial_x, "initial_utility": sa.initial_utility,
                        "initial_energy": sa.initial_energy, "seed": req.params.seed})
            for snap in sa.steps():
                yield _sse({"type": "step", **snap})
                await asyncio.sleep(req.delay_ms / 1000.0)
            st = exact_status(problem)
            exact_u = solve_exact(problem)["utility"] if st["allowed"] else None
            yield _sse({"type": "result", "result": sa.result(exact_u)})
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # pragma: no cover
            yield _sse({"type": "error", "detail": str(exc)})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ----------------------------------------------------------------------------- baselines / exact / experiments
@router.post("/compare", response_model=CompareOut, tags=["comparison"])
def compare(req: CompareRequest) -> Any:
    """Run SA, Equal, Greedy, Random Feasible and (when allowed) the Exact optimum on one instance."""
    return compare_methods(req.problem.to_problem(), req.params.to_params(), req.random_samples, req.run_exact)


@router.post("/exact", response_model=ExactResponse, tags=["exact"])
def exact(req: ExactRequest) -> Any:
    problem = req.problem.to_problem()
    st = exact_status(problem)
    if not st["allowed"]:
        raise HTTPException(422, st["reason"])
    try:
        return {"status": st, "exact": solve_exact(problem)}
    except ExactTooLarge as e:
        raise HTTPException(422, str(e))


@router.post("/experiments/run", tags=["experiments"])
def experiments(req: ExperimentRequest) -> dict:
    return run_experiment(req.problem.to_problem(), req.params.to_params(), req.n_runs, req.random_samples,
                          req.include_exact)


@router.post("/sensitivity/run", tags=["experiments"])
def sensitivity(req: SensitivityRequest) -> dict:
    return run_sensitivity(req.problem.to_problem(), req.params.to_params(), req.alphas, req.t0s,
                           req.runs_per_config, req.include_exact)
