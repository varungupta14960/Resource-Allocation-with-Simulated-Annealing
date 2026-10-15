"""Baseline allocation strategies (all real implementations; none uses stored numbers)."""
from __future__ import annotations

import random
from typing import Optional

from ..config import TOL
from ..core.problem import Problem
from .construction import random_feasible_allocation


def equal_allocation(problem: Problem) -> list[int]:
    """Give every project the same unit count c (clipped into [L_j, U_j]) at the *largest* c that fits.
    If even c = 0 (every project at its minimum) does not fit, fall back to funding the cheapest
    projects first (by normalised minimum cost) and then equalise among those."""
    n, m = problem.n, problem.m

    def level_alloc(c: int, members: list[int]) -> list[int]:
        x = [0] * n
        for j in members:
            x[j] = min(max(c, problem.L[j]), problem.U[j])
        return x

    everyone = list(range(n))
    for c in range(max(problem.U), -1, -1):
        x = level_alloc(c, everyone)
        if problem.is_resource_feasible(x):
            return x

    # fallback: choose subset greedily by cheapest normalised cost of the minimum allocation
    def min_cost(j: int) -> float:
        return sum(problem.A[i][j] * problem.L[j] / problem.R[i] for i in range(m))

    members: list[int] = []
    for j in sorted(everyone, key=min_cost):
        trial = members + [j]
        if problem.is_resource_feasible(level_alloc(0, trial)):
            members = trial
    for c in range(max(problem.U), -1, -1):
        x = level_alloc(c, members)
        if problem.is_resource_feasible(x):
            return x
    return [0] * n


def greedy_allocation(problem: Problem) -> tuple[list[int], int]:
    """Repeatedly take the feasible step with the highest  (utility gain) / (normalised resource cost):
    activate an inactive project at L_j, or add one unit to an active project.  Returns (x, evaluations)."""
    n, m = problem.n, problem.m
    x = [0] * n
    usage = [0.0] * m
    evals = 0
    while True:
        best_j, best_new, best_ratio = -1, 0, -1.0
        for j in range(n):
            if x[j] == 0:
                new = problem.L[j]
            elif x[j] < problem.U[j]:
                new = x[j] + 1
            else:
                continue
            d = new - x[j]
            col = problem.A_cols[j]
            if any(usage[i] + col[i] * d > problem.R[i] + TOL for i in range(m)):
                continue
            evals += 1
            gain = problem.util_table[j][new] - problem.util_table[j][x[j]]
            cost = sum(col[i] * d / problem.R[i] for i in range(m))
            ratio = gain / cost if cost > 0 else float("inf")
            if ratio > best_ratio:
                best_j, best_new, best_ratio = j, new, ratio
        if best_j < 0:
            return x, evals
        d = best_new - x[best_j]
        for i in range(m):
            usage[i] += problem.A_cols[best_j][i] * d
        x[best_j] = best_new


def random_feasible_search(problem: Problem, rnd: random.Random, n_samples: int) -> tuple[list[int], float, int]:
    """Best of `n_samples` independent random feasible allocations.  Returns (x, utility, samples)."""
    best_x: Optional[list[int]] = None
    best_u = -1.0
    tab, n = problem.util_table, problem.n
    for _ in range(max(1, n_samples)):
        x = random_feasible_allocation(problem, rnd, activation_prob=rnd.uniform(0.4, 1.0))
        u = 0.0
        for j in range(n):
            if x[j]:
                u += tab[j][x[j]]
        if u > best_u:
            best_u, best_x = u, x
    return best_x or [0] * n, max(best_u, 0.0), max(1, n_samples)
