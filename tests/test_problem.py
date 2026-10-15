import math

import pytest

from app.core.metrics import describe, evaluate, optimality_gap_pct


def test_utility_matches_review1_hand_calculation(toy):
    # Review-1 section 3.3: x = (3, 0, 4, 2) -> U = 31.08 + 0 + 34.94 + 17.47 = 83.49
    x = [3, 0, 4, 2]
    assert toy.utility(x) == pytest.approx(83.49, abs=0.01)
    assert toy.project_utility(0, 3) == pytest.approx(40 * (1 - math.exp(-1.5)))
    assert toy.project_utility(1, 0) == 0.0


def test_utility_rejects_out_of_domain_value(toy):
    with pytest.raises(ValueError):
        toy.utility([1, 0, 4, 2])        # project A has L=2, so 1 is not allowed


def test_feasible_state_has_zero_penalty_and_energy_is_minus_utility(toy):
    x = [3, 0, 4, 2]                      # budget 90 <= 100, manpower 98 <= 120
    assert toy.usage(x) == pytest.approx([90, 98])
    assert toy.is_feasible(x)
    assert toy.penalty(x, 500) == 0.0
    assert toy.energy(x, 500) == pytest.approx(-toy.utility(x))


def test_penalty_matches_review1_toy_violation(toy):
    # Toggle B on: x = (3, 2, 4, 2) -> budget 106 vs 100 (6 % over) ; lambda = 500 -> penalty 30
    x = [3, 2, 4, 2]
    assert toy.usage(x)[0] == pytest.approx(106)
    assert not toy.is_feasible(x)
    assert toy.penalty(x, 500) == pytest.approx(30.0)
    assert toy.utility(x) == pytest.approx(100.01, abs=0.02)
    assert toy.energy(x, 500) == pytest.approx(-toy.utility(x) + 30.0)


def test_penalty_sums_over_resources(toy):
    x = [6, 6, 8, 5]                      # violates both resources
    rel = toy.relative_violations(x)
    assert all(r > 0 for r in rel)
    assert toy.penalty(x, 10) == pytest.approx(10 * sum(rel))


def test_domain_check(toy):
    assert toy.in_domain([0, 0, 0, 0])
    assert toy.in_domain([2, 6, 3, 1])
    assert not toy.in_domain([1, 0, 0, 0])      # below L
    assert not toy.in_domain([7, 0, 0, 0])      # above U
    assert not toy.in_domain([2.5, 0, 0, 0])    # not an integer


def test_feasibility_requires_all_resources(toy):
    assert toy.is_feasible([0, 0, 0, 0])
    assert not toy.is_feasible([6, 6, 8, 5])


def test_default_penalty_is_ten_times_max_benefit(toy):
    assert toy.default_penalty() == 500.0


def test_search_space_size(toy):
    assert toy.search_space_size() == 6 * 6 * 7 * 6


def test_evaluate_record(toy):
    rec = evaluate(toy, [3, 0, 4, 2], 500)
    assert rec["feasible"] and rec["n_violations"] == 0
    assert rec["mean_utilization"] == pytest.approx((0.90 + 98 / 120) / 2)


def test_optimality_gap_formula():
    assert optimality_gap_pct(100.0, 95.0) == pytest.approx(5.0)
    assert optimality_gap_pct(100.0, 100.0) == 0.0
    assert optimality_gap_pct(None, 90.0) is None          # never fabricated
    assert optimality_gap_pct(0.0, 0.0) is None


def test_describe_uses_sample_std():
    d = describe([1, 2, 3, 4])
    assert d["mean"] == 2.5 and d["median"] == 2.5
    assert d["std"] == pytest.approx(1.2909944, rel=1e-6)
    assert d["min"] == 1 and d["max"] == 4
