"""Simulated Annealing for integer multi-resource allocation (penalty-based constraint handling).

Algorithm (one *level* = one temperature, one *chain* = `chain_length` proposals at that level):

    x <- random feasible start;  E <- E(x);  T <- T0
    while T > Tmin:
        repeat chain_length times:
            x' <- neighbour(x);  dE <- E(x') - E(x)
            accept if dE <= 0, else with probability exp(-dE / T)
            if x is feasible and U(x) > U(best): best <- x
        T <- alpha * T
    return best feasible allocation

The loop is written as a generator (`steps`) so that the very same code drives the
batch API, the experiment runner and the live Server-Sent-Events stream.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass
from time import perf_counter
from typing import Iterator, Optional

from ..config import TOL
from ..core.metrics import method_result
from ..core.problem import Problem
from .construction import random_feasible_allocation
from .neighbourhood import propose_move


@dataclass
class SAParams:
    t0: float = 50.0               # Initial Test Value
    alpha: float = 0.95            # Initial Test Value
    t_min: float = 0.01            # Initial Test Value
    chain_length: int = 100        # Initial Test Value
    penalty_weight: Optional[float] = None   # None -> 10 x max_j v_j
    seed: int = 42
    patience: int = 0              # optional: stop after this many levels without improvement (0 = off)


def acceptance_probability(delta_e: float, temperature: float) -> float:
    """Metropolis rule: 1 if dE <= 0, otherwise exp(-dE / T)."""
    if delta_e <= 0:
        return 1.0
    if temperature <= 0:
        return 0.0
    return math.exp(-delta_e / temperature)


def temperature_levels(t0: float, alpha: float, t_min: float) -> int:
    """Number of temperature levels visited by `while T > Tmin: ...; T = alpha*T`."""
    levels, t = 0, t0
    while t > t_min:
        levels += 1
        t *= alpha
    return levels


class SimulatedAnnealing:
    def __init__(self, problem: Problem, params: SAParams):
        self.problem = problem
        self.params = params
        self.lam = params.penalty_weight if params.penalty_weight is not None else problem.default_penalty()
        self.rnd = random.Random(params.seed)
        self.total_levels = temperature_levels(params.t0, params.alpha, params.t_min)

        self.x = random_feasible_allocation(problem, self.rnd, activation_prob=0.5)
        self.initial_x = list(self.x)
        self.initial_utility = problem.utility(self.x)
        self.initial_energy = problem.energy(self.x, self.lam)

        self.best_x = list(self.x)
        self.best_utility = self.initial_utility
        self.best_found_iteration = 0
        self.min_energy_visited = self.initial_energy

        self.iteration = 0
        self.levels_done = 0
        self.improving = self.uphill = self.rejected = self.noop = self.infeasible_iters = 0
        self.runtime_s = 0.0
        self.stop_reason = "not_started"
        self.history: list[dict] = []
        self.done = False

    # ------------------------------------------------------------------ main loop
    def steps(self) -> Iterator[dict]:
        P, prm = self.problem, self.params
        m = P.m
        L, U, tab, cols, R, Rinv = P.L, P.U, P.util_table, P.A_cols, P.R, P.R_inv
        lam, rnd = self.lam, self.rnd
        rand, exp = rnd.random, math.exp

        x = self.x
        usage = P.usage(x)
        u_cur = P.utility(x)
        e_cur = P.energy(x, lam)
        feas_cur = True
        T = prm.t0
        stale = 0
        self.stop_reason = "t_min"

        while T > prm.t_min:
            t_start = perf_counter()
            imp = up = rej = 0
            last = "init"
            best_before = self.best_utility
            it = self.iteration
            for _ in range(prm.chain_length):
                it += 1
                move = propose_move(x, L, U, rnd)
                if not move:
                    rej += 1
                    self.noop += 1
                    last = "no move"
                    if not feas_cur:
                        self.infeasible_iters += 1
                    continue
                d_u = 0.0
                new_usage = usage[:]
                for j, nv in move:
                    ov = x[j]
                    d_u += tab[j][nv] - tab[j][ov]
                    dv = nv - ov
                    col = cols[j]
                    for i in range(m):
                        new_usage[i] += col[i] * dv
                viol = 0.0
                feas = True
                for i in range(m):
                    ex = new_usage[i] - R[i]
                    if ex > TOL:
                        viol += ex * Rinv[i]
                        feas = False
                new_u = u_cur + d_u
                new_e = -new_u + lam * viol
                d_e = new_e - e_cur
                if d_e <= 0:
                    accept = True
                    imp += 1
                    last = "improved (dE<=0)"
                elif rand() < exp(-d_e / T):
                    accept = True
                    up += 1
                    last = "accepted worse"
                else:
                    accept = False
                    rej += 1
                    last = "rejected"
                if accept:
                    for j, nv in move:
                        x[j] = nv
                    usage, u_cur, e_cur, feas_cur = new_usage, new_u, new_e, feas
                    if e_cur < self.min_energy_visited:
                        self.min_energy_visited = e_cur
                    if feas and u_cur > self.best_utility + 1e-12:
                        self.best_utility = u_cur
                        self.best_x = x[:]
                        self.best_found_iteration = it
                if not feas_cur:
                    self.infeasible_iters += 1

            # resynchronise incremental values to remove floating-point drift
            usage = P.usage(x)
            u_cur = P.utility(x)
            e_cur = P.energy(x, lam)
            feas_cur = P.is_resource_feasible(x)

            self.iteration = it
            self.improving += imp
            self.uphill += up
            self.rejected += rej
            self.levels_done += 1
            self.runtime_s += perf_counter() - t_start

            snap = {
                "step": self.levels_done,
                "iteration": it,
                "temperature": T,
                "current_energy": e_cur,
                "current_utility": u_cur,
                "current_feasible": feas_cur,
                "best_utility": self.best_utility,
                "best_energy": -self.best_utility,
                "accept_rate": (imp + up) / prm.chain_length,
                "improving": imp,
                "uphill": up,
                "rejected": rej,
                "last_status": last,
            }
            self.history.append(snap)
            yield {**snap, "current_allocation": x[:], "best_allocation": self.best_x[:]}

            T *= prm.alpha
            stale = 0 if self.best_utility > best_before + 1e-12 else stale + 1
            if prm.patience and stale >= prm.patience:
                self.stop_reason = "patience"
                break

        self.x = x
        self.done = True

    def run(self) -> dict:
        for _ in self.steps():
            pass
        return self.result()

    # ------------------------------------------------------------------ result
    def result(self, exact_utility: Optional[float] = None) -> dict:
        P, prm = self.problem, self.params
        runtime_ms = self.runtime_s * 1000.0
        best = method_result(P, "sa", "Simulated Annealing", self.best_x, self.lam, runtime_ms,
                             self.iteration, exact_utility)
        final_x = list(self.x)
        return {
            "seed": prm.seed,
            "params": {"t0": prm.t0, "alpha": prm.alpha, "t_min": prm.t_min, "chain_length": prm.chain_length,
                       "penalty_weight": self.lam, "seed": prm.seed, "patience": prm.patience},
            "initial": {"allocation": self.initial_x, "utility": self.initial_utility,
                        "energy": self.initial_energy, "feasible": True},
            "final": {"allocation": final_x, "utility": P.utility(final_x),
                      "energy": P.energy(final_x, self.lam), "feasible": P.is_feasible(final_x)},
            "best": best,
            "history": self.history,
            "stats": {
                "iterations": self.iteration,
                "levels": self.levels_done,
                "accepted": self.improving + self.uphill,
                "improving": self.improving,
                "uphill_accepted": self.uphill,
                "rejected": self.rejected,
                "noop_moves": self.noop,
                "infeasible_iterations": self.infeasible_iters,
                "runtime_ms": runtime_ms,
                "stop_reason": self.stop_reason,
                "best_found_iteration": self.best_found_iteration,
                "min_energy_visited": self.min_energy_visited,
            },
            "exact_utility": exact_utility,
        }


def run_sa(problem: Problem, params: SAParams, exact_utility: Optional[float] = None) -> dict:
    sa = SimulatedAnnealing(problem, params)
    for _ in sa.steps():
        pass
    return sa.result(exact_utility)
