"""Multi-run experiments and parameter-sensitivity sweeps.  Every number is produced by running
the algorithms; seeds are explicit so every experiment is reproducible."""
from __future__ import annotations

import math
import random
from time import perf_counter
from typing import Optional

import numpy as np

from ..algorithms.baselines import equal_allocation, greedy_allocation, random_feasible_search
from ..algorithms.exact import exact_status, solve_exact
from ..algorithms.simulated_annealing import SAParams, SimulatedAnnealing
from ..config import EXACT_MAX_SPACE
from ..core.metrics import describe, method_result, optimality_gap_pct
from ..core.problem import Problem

RANDOM_SEED_OFFSET = 7_000_000


def deterministic_baselines(problem: Problem, lam: float, exact_u: Optional[float]) -> tuple[dict, dict]:
    t = perf_counter()
    xe = equal_allocation(problem)
    rt_e = (perf_counter() - t) * 1000
    t = perf_counter()
    xg, ev = greedy_allocation(problem)
    rt_g = (perf_counter() - t) * 1000
    eq = method_result(problem, "equal", "Equal Allocation", xe, lam, rt_e, 1, exact_u,
                       "Largest common level (clipped to [L_j, U_j]) that fits.")
    gr = method_result(problem, "greedy", "Greedy Allocation", xg, lam, rt_g, ev, exact_u,
                       "Highest utility gain per normalised resource cost first.")
    return eq, gr


def random_baseline(problem: Problem, lam: float, seed: int, samples: int, exact_u: Optional[float]) -> dict:
    rnd = random.Random(seed + RANDOM_SEED_OFFSET)
    t = perf_counter()
    x, _, used = random_feasible_search(problem, rnd, samples)
    rt = (perf_counter() - t) * 1000
    return method_result(problem, "random", "Random Feasible (best of N)", x, lam, rt, used, exact_u,
                         f"Best of {used:,} random feasible allocations (seed {seed + RANDOM_SEED_OFFSET}).")


def maybe_exact(problem: Problem, run: bool) -> tuple[dict, Optional[dict]]:
    status = exact_status(problem, EXACT_MAX_SPACE)
    if run and status["allowed"]:
        return status, solve_exact(problem)
    return status, None


def compare_methods(problem: Problem, params: SAParams, random_samples: Optional[int], run_exact: bool) -> dict:
    status, exact = maybe_exact(problem, run_exact)
    exact_u = exact["utility"] if exact else None
    sa = SimulatedAnnealing(problem, params)
    for _ in sa.steps():
        pass
    sa_run = sa.result(exact_u)
    lam = sa.lam
    samples = random_samples or sa.iteration
    eq, gr = deterministic_baselines(problem, lam, exact_u)
    rnd = random_baseline(problem, lam, params.seed, samples, exact_u)
    methods = [sa_run["best"], eq, gr, rnd]
    if exact:
        methods.append(method_result(problem, "exact", "Exact Optimum (exhaustive)", exact["allocation"], lam,
                                     exact["runtime_ms"], exact["feasible_solutions"], exact_u,
                                     f"Enumerated {exact['feasible_solutions']:,} feasible allocations."))
    feas = [m for m in methods if m["feasible"]]
    top = max(m["utility"] for m in feas)
    tied = [m["method"] for m in feas if abs(m["utility"] - top) < 1e-9]
    messages = [] if exact else [status["reason"] or "Exact optimum not requested."]
    if not exact and status["reason"] is None:
        messages = ["Exact optimum not computed for this run (disabled by the user)."]
    return {"seed": params.seed, "lam": lam, "random_samples": samples, "methods": methods, "sa_run": sa_run,
            "exact": exact, "exact_status": status, "best_method": tied[0], "best_methods_tied": tied,
            "messages": messages}


# ----------------------------------------------------------------------------- 30-run experiment
def _carry(history: list[dict], length: int, key: str) -> list[float]:
    vals = [h[key] for h in history]
    return vals + [vals[-1]] * (length - len(vals))


def run_experiment(problem: Problem, params: SAParams, n_runs: int, random_samples: Optional[int],
                   include_exact: bool) -> dict:
    status, exact = maybe_exact(problem, include_exact)
    exact_u = exact["utility"] if exact else None
    lam = params.penalty_weight if params.penalty_weight is not None else problem.default_penalty()

    runs, histories, rand_runs = [], [], []
    best_run, worst_run = None, None
    for r in range(n_runs):
        seed = params.seed + r
        sa = SimulatedAnnealing(problem, SAParams(**{**params.__dict__, "seed": seed}))
        for _ in sa.steps():
            pass
        res = sa.result(exact_u)
        b = res["best"]
        samples = random_samples or sa.iteration
        rb = random_baseline(problem, lam, seed, samples, exact_u)
        runs.append({
            "run": r + 1, "seed": seed, "sa_utility": b["utility"], "sa_energy": b["energy"],
            "sa_feasible": b["feasible"], "sa_runtime_ms": b["runtime_ms"], "sa_iterations": sa.iteration,
            "sa_mean_utilization": b["mean_utilization"], "sa_gap_pct": b["optimality_gap_pct"],
            "sa_best_found_iteration": res["stats"]["best_found_iteration"],
            "random_utility": rb["utility"], "random_runtime_ms": rb["runtime_ms"],
            "random_gap_pct": rb["optimality_gap_pct"],
        })
        histories.append(res["history"])
        if best_run is None or b["utility"] > best_run["utility"]:
            best_run = {**b, "seed": seed, "run": r + 1}
        if worst_run is None or b["utility"] < worst_run["utility"]:
            worst_run = {**b, "seed": seed, "run": r + 1}

    eq, gr = deterministic_baselines(problem, lam, exact_u)

    u = [x["sa_utility"] for x in runs]
    ru = [x["random_utility"] for x in runs]
    gaps = [x["sa_gap_pct"] for x in runs if x["sa_gap_pct"] is not None]
    n_steps = max(len(h) for h in histories)
    mat = np.array([_carry(h, n_steps, "best_utility") for h in histories])
    longest = max(histories, key=len)
    hist_bins = max(3, min(12, int(round(math.sqrt(n_runs) * 1.5))))
    counts, edges = np.histogram(u, bins=hist_bins)
    rcounts, _ = np.histogram(ru, bins=edges)
    hit = None
    if exact_u is not None:
        hit = sum(1 for x in u if x >= exact_u - 1e-9)
    return {
        "n_runs": n_runs, "base_seed": params.seed, "seeds": [x["seed"] for x in runs], "lam": lam,
        "params": {"t0": params.t0, "alpha": params.alpha, "t_min": params.t_min,
                   "chain_length": params.chain_length, "penalty_weight": lam},
        "runs": runs,
        "sa": {"utility": describe(u), "runtime_ms": describe([x["sa_runtime_ms"] for x in runs]),
               "gap_pct": describe(gaps) if gaps else None, "all_feasible": all(x["sa_feasible"] for x in runs),
               "optimum_hits": hit, "iterations": runs[0]["sa_iterations"]},
        "random": {"utility": describe(ru), "runtime_ms": describe([x["random_runtime_ms"] for x in runs]),
                   "samples": random_samples or runs[0]["sa_iterations"]},
        "equal": eq, "greedy": gr,
        "best_run": best_run, "worst_run": worst_run,
        "histogram": [{"lo": float(edges[i]), "hi": float(edges[i + 1]), "sa": int(counts[i]),
                       "random": int(rcounts[i])} for i in range(len(counts))],
        "convergence": {
            "iteration": [h["iteration"] for h in longest] + [longest[-1]["iteration"]] * (n_steps - len(longest)),
            "temperature": [h["temperature"] for h in longest],
            "mean": mat.mean(axis=0).tolist(), "min": mat.min(axis=0).tolist(), "max": mat.max(axis=0).tolist(),
        },
        "exact": exact, "exact_status": status,
        "exact_utility": exact_u,
    }


# ----------------------------------------------------------------------------- sensitivity
def run_sensitivity(problem: Problem, base: SAParams, alphas: list[float], t0s: list[float],
                    runs_per_config: int, include_exact: bool) -> dict:
    status, exact = maybe_exact(problem, include_exact)
    exact_u = exact["utility"] if exact else None
    configs = []
    grid = np.linspace(0, 1, 50)
    for a in alphas:
        for t0 in t0s:
            prm = {**base.__dict__, "alpha": a, "t0": t0}
            utils, rts, its, curves, found_at = [], [], [], [], []
            for r in range(runs_per_config):
                sa = SimulatedAnnealing(problem, SAParams(**{**prm, "seed": base.seed + r}))
                for _ in sa.steps():
                    pass
                res = sa.result(exact_u)
                utils.append(res["best"]["utility"])
                rts.append(res["best"]["runtime_ms"])
                its.append(sa.iteration)
                found_at.append(res["stats"]["best_found_iteration"])
                bu = [h["best_utility"] for h in res["history"]]
                xs = np.linspace(0, 1, len(bu))
                curves.append(np.interp(grid, xs, bu))
            mean_u = float(np.mean(utils))
            configs.append({
                "alpha": a, "t0": t0, "runs": runs_per_config,
                "mean_utility": mean_u, "std_utility": float(np.std(utils, ddof=1)) if len(utils) > 1 else 0.0,
                "best_utility": float(max(utils)), "worst_utility": float(min(utils)),
                "mean_runtime_ms": float(np.mean(rts)), "mean_iterations": float(np.mean(its)),
                "mean_best_found_iteration": float(np.mean(found_at)),
                "mean_gap_pct": optimality_gap_pct(exact_u, mean_u) if exact_u else None,
                "optimum_hits": sum(1 for x in utils if exact_u is not None and x >= exact_u - 1e-9) if exact_u else None,
                "convergence": np.mean(curves, axis=0).tolist(),
            })
    best = max(configs, key=lambda c: (round(c["mean_utility"], 9), -c["mean_runtime_ms"]))
    tied = sum(1 for c in configs if abs(c["mean_utility"] - best["mean_utility"]) < 1e-9)
    return {"seed": base.seed, "runs_per_config": runs_per_config, "alphas": alphas, "t0s": t0s,
            "progress": grid.tolist(), "configs": configs,
            "best_config": {"alpha": best["alpha"], "t0": best["t0"], "mean_utility": best["mean_utility"],
                            "mean_runtime_ms": best["mean_runtime_ms"], "tied_on_utility": tied,
                            "label": "Best observed configuration for this experiment"},
            "exact_utility": exact_u, "exact_status": status,
            "params": {"t_min": base.t_min, "chain_length": base.chain_length}}
