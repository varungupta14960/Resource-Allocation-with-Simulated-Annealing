"""Random feasible construction (used for SA's initial state and the random-feasible baseline)."""
from __future__ import annotations

import random

from ..core.problem import Problem


def random_feasible_allocation(problem: Problem, rnd: random.Random, activation_prob: float = 0.5) -> list[int]:
    """Shuffle the projects; for each, with probability `activation_prob`, try to activate it at a
    random level in [L_j, max feasible level].  A project is kept only if every resource still fits,
    so the result is always feasible (the all-zero vector is feasible by definition)."""
    n = problem.n
    x = [0] * n
    usage = [0.0] * problem.m
    order = list(range(n))
    rnd.shuffle(order)
    for j in order:
        if rnd.random() >= activation_prob:
            continue
        hi = problem.max_feasible_value(j, usage)
        if hi < problem.L[j]:
            continue
        level = rnd.randint(problem.L[j], hi)
        x[j] = level
        col = problem.A_cols[j]
        for i in range(problem.m):
            usage[i] += col[i] * level
    return x
