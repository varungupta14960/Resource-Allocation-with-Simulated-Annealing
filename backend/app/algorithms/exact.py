"""Exact optimum by exhaustive enumeration with feasibility pruning (small instances only).

For each project the domain is {0, L_j, ..., U_j}.  Because every a_ij >= 0, resource usage grows with
the value tried, so once a value violates a capacity all larger values of the same project are skipped
(pruning never removes a feasible solution -> the result is still the true optimum)."""
from __future__ import annotations

import math
from time import perf_counter
from typing import Optional

from ..config import EXACT_MAX_SPACE, TOL
from ..core.problem import Problem


class ExactTooLarge(ValueError):
    pass


def exact_status(problem: Problem, max_space: int = EXACT_MAX_SPACE) -> dict:
    """Is exhaustive search allowed for this instance?  (Never silently runs on large instances.)"""
    space = problem.search_space_size()
    allowed = space <= max_space
    reason = None if allowed else (
        f"Search space has {space:,} candidate allocations (limit {max_space:,}). "
        "Exact optimum not computed for this instance."
    )
    return {"allowed": allowed, "search_space": str(space), "search_space_log10": math.log10(space),
            "limit": max_space, "reason": reason}


def solve_exact(problem: Problem, max_space: int = EXACT_MAX_SPACE) -> dict:
    space = problem.search_space_size()
    if space > max_space:
        raise ExactTooLarge(
            f"Exact enumeration refused: {space:,} candidate allocations exceeds the limit of {max_space:,}."
        )
    n, m = problem.n, problem.m
    L, U, R, tab, cols = problem.L, problem.U, problem.R, problem.util_table, problem.A_cols
    domains = [[0] + list(range(L[j], U[j] + 1)) for j in range(n)]
    x = [0] * n
    best: dict = {"u": -1.0, "x": [0] * n}
    counters = {"feasible": 0, "nodes": 0}

    def rec(j: int, usage: list[float], u: float) -> None:
        if j == n:
            counters["feasible"] += 1
            if u > best["u"] + 1e-12:
                best["u"] = u
                best["x"] = x[:]
            return
        col = cols[j]
        for val in domains[j]:
            counters["nodes"] += 1
            nu = [usage[i] + col[i] * val for i in range(m)]
            if any(nu[i] > R[i] + TOL for i in range(m)):
                break                      # larger values only consume more
            x[j] = val
            rec(j + 1, nu, u + tab[j][val])
        x[j] = 0

    t0 = perf_counter()
    rec(0, [0.0] * m, 0.0)
    runtime_ms = (perf_counter() - t0) * 1000.0
    return {
        "allocation": best["x"],
        "utility": best["u"],
        "feasible_solutions": counters["feasible"],
        "nodes_visited": counters["nodes"],
        "search_space": space,
        "runtime_ms": runtime_ms,
    }
