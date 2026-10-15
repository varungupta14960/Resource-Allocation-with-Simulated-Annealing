import math

import pytest

from app.algorithms.exact import solve_exact
from app.algorithms.simulated_annealing import (SAParams, SimulatedAnnealing, acceptance_probability,
                                                run_sa, temperature_levels)


def test_acceptance_probability_rule():
    assert acceptance_probability(-3.0, 10) == 1.0
    assert acceptance_probability(0.0, 10) == 1.0
    assert acceptance_probability(2.68, 5) == pytest.approx(math.exp(-2.68 / 5))   # ~0.59 (Review-1 check)
    assert acceptance_probability(2.68, 1) == pytest.approx(0.0686, abs=1e-3)      # ~0.07
    assert acceptance_probability(5.0, 0.0) == 0.0
    assert 0 < acceptance_probability(5.0, 1000) < 1
    assert acceptance_probability(5.0, 1) < acceptance_probability(5.0, 10)        # hotter -> more accepting


def test_temperature_levels_match_report():
    # Review-1: ln(Tmin/T0)/ln(alpha) ~ 166 levels -> ~16,600 evaluations with chain 100
    assert temperature_levels(50, 0.95, 0.01) in (166, 167)


def test_sa_returns_feasible_best_and_consistent_energy(medium):
    res = run_sa(medium, SAParams(seed=1))
    best = res["best"]
    assert best["feasible"] and best["n_violations"] == 0
    assert medium.is_feasible(best["allocation"])
    assert best["utility"] == pytest.approx(medium.utility(best["allocation"]))
    assert best["energy"] == pytest.approx(-best["utility"])
    assert best["utility"] >= res["initial"]["utility"]                 # best can never be worse than the start
    st = res["stats"]
    assert st["accepted"] + st["rejected"] == st["iterations"]
    assert st["iterations"] == res["stats"]["levels"] * 100


def test_sa_is_reproducible_for_same_seed(medium):
    a = run_sa(medium, SAParams(seed=11))
    b = run_sa(medium, SAParams(seed=11))
    assert a["best"]["allocation"] == b["best"]["allocation"]
    assert [h["current_energy"] for h in a["history"]] == [h["current_energy"] for h in b["history"]]
    c = run_sa(medium, SAParams(seed=12))
    assert [h["current_energy"] for h in a["history"]] != [h["current_energy"] for h in c["history"]]


def test_best_utility_is_monotone_and_temperature_decreases(medium):
    h = run_sa(medium, SAParams(seed=3))["history"]
    assert all(h[i + 1]["best_utility"] >= h[i]["best_utility"] for i in range(len(h) - 1))
    assert all(h[i + 1]["temperature"] < h[i]["temperature"] for i in range(len(h) - 1))
    assert h[-1]["temperature"] > 0.01 * 0.95 - 1e-12


def test_sa_reaches_exact_optimum_on_small_instances(small, toy):
    for p in (toy, small):
        opt = solve_exact(p)["utility"]
        res = run_sa(p, SAParams(seed=42), opt)
        assert res["best"]["utility"] <= opt + 1e-9                      # can never beat the optimum
        assert res["best"]["optimality_gap_pct"] is not None
        assert res["best"]["optimality_gap_pct"] < 2.0                   # loose, honest tolerance


def test_penalty_can_make_infeasible_states_visited_but_best_stays_feasible(medium):
    sim = SimulatedAnnealing(medium, SAParams(seed=5, t0=500))
    sim.run()
    assert medium.is_feasible(sim.best_x)


def test_streaming_generator_yields_one_snapshot_per_level(toy):
    sim = SimulatedAnnealing(toy, SAParams(seed=1, chain_length=10))
    snaps = list(sim.steps())
    assert len(snaps) == sim.total_levels == len(sim.history)
    assert snaps[0]["temperature"] == 50
    assert all(toy.in_domain(s["current_allocation"]) for s in snaps)


def test_patience_stops_early(toy):
    res = run_sa(toy, SAParams(seed=1, patience=5))
    assert res["stats"]["stop_reason"] == "patience"
    assert res["stats"]["levels"] < temperature_levels(50, 0.95, 0.01)
