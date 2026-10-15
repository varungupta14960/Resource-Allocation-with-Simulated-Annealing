"""Metrics shared by every algorithm: evaluation record, optimality gap, descriptive statistics."""
from __future__ import annotations

from typing import Optional, Sequence

import numpy as np

from .problem import Problem


def optimality_gap_pct(exact_utility: Optional[float], utility: float) -> Optional[float]:
    """Gap = (U_exact - U_method) / U_exact x 100.  None when no exact optimum is available."""
    if exact_utility is None or exact_utility <= 0:
        return None
    gap = (exact_utility - utility) / exact_utility * 100.0
    return 0.0 if abs(gap) < 1e-9 else gap


def evaluate(problem: Problem, x: Sequence[int], lam: float) -> dict:
    usage = problem.usage(x)
    rel = problem.relative_violations(x)
    util = [u / r for u, r in zip(usage, problem.R)]
    u_total = problem.utility(x)
    return {
        "allocation": [int(a) for a in x],
        "utility": u_total,
        "energy": -u_total + lam * sum(rel),
        "feasible": problem.is_feasible(x),
        "usage": usage,
        "utilization": util,
        "mean_utilization": float(np.mean(util)),
        "n_violations": int(sum(1 for r in rel if r > 0)),
        "total_violation": float(sum(rel)),
    }


def method_result(problem: Problem, key: str, name: str, x: Sequence[int], lam: float, runtime_ms: float,
                  evaluations: Optional[int], exact_utility: Optional[float] = None, note: str = "") -> dict:
    rec = evaluate(problem, x, lam)
    rec.update(
        key=key, method=name, runtime_ms=runtime_ms, evaluations=evaluations, note=note,
        optimality_gap_pct=optimality_gap_pct(exact_utility, rec["utility"]) if rec["feasible"] else None,
    )
    return rec


def describe(values: Sequence[float]) -> dict:
    """Descriptive statistics (sample standard deviation, ddof=1, when n > 1)."""
    a = np.asarray(values, dtype=float)
    if a.size == 0:
        return {k: None for k in ("n", "mean", "median", "std", "min", "max", "q1", "q3")}
    return {
        "n": int(a.size),
        "mean": float(a.mean()),
        "median": float(np.median(a)),
        "std": float(a.std(ddof=1)) if a.size > 1 else 0.0,
        "min": float(a.min()),
        "max": float(a.max()),
        "q1": float(np.percentile(a, 25)),
        "q3": float(np.percentile(a, 75)),
    }
