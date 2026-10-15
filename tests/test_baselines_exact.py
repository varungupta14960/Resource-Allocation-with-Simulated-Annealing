import itertools
import random

import pytest

from app.algorithms.baselines import equal_allocation, greedy_allocation, random_feasible_search
from app.algorithms.exact import ExactTooLarge, exact_status, solve_exact
from app.core.problem import Problem


def tiny_problem(seed: int) -> Problem:
    r = random.Random(seed)
    n, m = 4, 2
    L = [r.randint(1, 2) for _ in range(n)]
    U = [l + r.randint(1, 3) for l in L]
    A = [[round(r.uniform(1, 6), 1) for _ in range(n)] for _ in range(m)]
    R = [round(sum(A[i][j] * U[j] for j in range(n)) * 0.4, 1) for i in range(m)]
    return Problem(name="t", project_names=list("ABCD"), resource_names=["r1", "r2"], L=L, U=U,
                   v=[r.randint(20, 90) for _ in range(n)], k=[round(r.uniform(.2, .6), 2) for _ in range(n)], A=A, R=R)


def brute_force(p: Problem) -> float:
    domains = [[0] + list(range(p.L[j], p.U[j] + 1)) for j in range(p.n)]
    return max((p.utility(x) for x in itertools.product(*domains) if p.is_feasible(x)), default=0.0)


@pytest.mark.parametrize("seed", range(8))
def test_exact_solver_matches_independent_brute_force(seed):
    p = tiny_problem(seed)
    res = solve_exact(p)
    assert res["utility"] == pytest.approx(brute_force(p))
    assert p.is_feasible(res["allocation"])
    n_feasible = sum(1 for x in itertools.product(*[[0] + list(range(p.L[j], p.U[j] + 1)) for j in range(p.n)])
                     if p.is_feasible(x))
    assert res["feasible_solutions"] == n_feasible


def test_exact_refuses_large_instances(medium):
    assert not exact_status(medium)["allowed"]
    with pytest.raises(ExactTooLarge):
        solve_exact(medium)


def test_exact_allowed_for_small(small, toy):
    assert exact_status(small)["allowed"] and exact_status(toy)["allowed"]


def test_equal_allocation_is_feasible_and_equal_where_unclipped(small, medium, toy):
    for p in (small, medium, toy):
        x = equal_allocation(p)
        assert p.is_feasible(x)
    # Equal allocation: no project may exceed the common level unless clipped by its own L
    x = equal_allocation(small)
    level = max(x[j] for j in range(small.n) if x[j] > small.L[j]) if any(x[j] > small.L[j] for j in range(small.n)) else 0
    assert all(x[j] == min(max(level, small.L[j]), small.U[j]) for j in range(small.n))


def test_equal_allocation_fallback_when_all_minimums_do_not_fit():
    p = Problem(name="tight", project_names=["a", "b", "c"], resource_names=["r"], L=[3, 3, 3], U=[5, 5, 5],
                v=[10, 10, 10], k=[.3, .3, .3], A=[[2, 2, 2]], R=[13])
    x = equal_allocation(p)
    assert p.is_feasible(x) and sum(1 for a in x if a > 0) == 2


def test_greedy_is_feasible_and_cannot_be_extended(small, medium):
    for p in (small, medium):
        x, evals = greedy_allocation(p)
        assert p.is_feasible(x) and evals > 0
        # local maximality: no single feasible +1 / activation step is left
        for j in range(p.n):
            y = list(x)
            y[j] = p.L[j] if x[j] == 0 else (x[j] + 1 if x[j] < p.U[j] else x[j])
            if y != x:
                assert not p.is_feasible(y)


def test_greedy_never_beats_exact(small):
    x, _ = greedy_allocation(small)
    assert small.utility(x) <= solve_exact(small)["utility"] + 1e-9


def test_random_feasible_search(small):
    x, u, used = random_feasible_search(small, random.Random(1), 200)
    assert small.is_feasible(x) and used == 200
    assert u == pytest.approx(small.utility(x))
    x2, u2, _ = random_feasible_search(small, random.Random(1), 200)
    assert x2 == x                                          # reproducible
    assert u <= solve_exact(small)["utility"] + 1e-9


def test_more_random_samples_never_hurt(small):
    _, u_small, _ = random_feasible_search(small, random.Random(2), 5)
    _, u_big, _ = random_feasible_search(small, random.Random(2), 5000)
    assert u_big >= u_small
