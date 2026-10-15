import random

from app.algorithms.construction import random_feasible_allocation
from app.algorithms.neighbourhood import apply_move, neighbour, propose_move


def test_neighbours_stay_in_domain_and_differ(medium):
    rnd = random.Random(7)
    x = random_feasible_allocation(medium, rnd)
    for _ in range(3000):
        mv = propose_move(x, medium.L, medium.U, rnd)
        assert mv, "a valid move should exist"
        y = apply_move(x, mv)
        assert medium.in_domain(y)             # snapping rule keeps viability domain by construction
        assert y != x
        x = y


def test_snapping_rules(toy, rnd):
    # project A: L=2, U=6.  Decreasing from 2 must give 0 (never 1); activating gives L (never 1).
    seen_down, seen_up = False, False
    for _ in range(2000):
        for x0 in ([2, 0, 0, 0], [0, 0, 0, 0]):
            y = neighbour(x0, toy.L, toy.U, rnd)
            assert y is not None and toy.in_domain(y)
            if x0[0] == 2 and y[0] != 2:
                seen_down = seen_down or y[0] == 0
            if x0[0] == 0 and y[0] != 0:
                seen_up = seen_up or y[0] == 2
    assert seen_down and seen_up


def test_random_feasible_allocation_is_always_feasible(medium):
    rnd = random.Random(5)
    for _ in range(500):
        x = random_feasible_allocation(medium, rnd, activation_prob=rnd.uniform(0.1, 1))
        assert medium.is_feasible(x)


def test_same_seed_same_neighbour(toy):
    a = neighbour([2, 0, 3, 1], toy.L, toy.U, random.Random(9))
    b = neighbour([2, 0, 3, 1], toy.L, toy.U, random.Random(9))
    assert a == b
