"""Typed request / response models (Pydantic v2).  These drive validation and the OpenAPI docs."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from ..algorithms.simulated_annealing import SAParams, temperature_levels
from ..config import MAX_SA_ITERATIONS, MAX_TOTAL_ITERATIONS
from ..core.problem import Problem


# ----------------------------------------------------------------------------- inputs
class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    L: int = Field(ge=1, description="Minimum viable allocation L_j (work units)")
    U: int = Field(ge=1, description="Maximum allocation U_j (work units)")
    v: float = Field(gt=0, description="Maximum benefit v_j")
    k: float = Field(gt=0, description="Saturation rate k_j")

    @model_validator(mode="after")
    def _l_le_u(self):
        if self.L > self.U:
            raise ValueError(f"Project '{self.name}': minimum L ({self.L}) must be <= maximum U ({self.U}).")
        return self


class ResourceIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    capacity: float = Field(gt=0, description="Capacity R_i (must be > 0)")


class ProblemIn(BaseModel):
    name: str = "Custom dataset"
    projects: list[ProjectIn] = Field(min_length=1, max_length=200)
    resources: list[ResourceIn] = Field(min_length=1, max_length=12)
    consumption: list[list[float]] = Field(description="a_ij matrix, shape (resources x projects)")

    @field_validator("consumption")
    @classmethod
    def _non_negative(cls, v):
        if any(a < 0 for row in v for a in row):
            raise ValueError("Resource consumption values a_ij must be non-negative.")
        return v

    @model_validator(mode="after")
    def _shape(self):
        m, n = len(self.resources), len(self.projects)
        if len(self.consumption) != m or any(len(r) != n for r in self.consumption):
            raise ValueError(f"Consumption matrix must have {m} rows (resources) and {n} columns (projects).")
        return self

    def to_problem(self) -> Problem:
        return Problem(
            name=self.name,
            project_names=[p.name for p in self.projects], resource_names=[r.name for r in self.resources],
            L=[p.L for p in self.projects], U=[p.U for p in self.projects],
            v=[p.v for p in self.projects], k=[p.k for p in self.projects],
            A=self.consumption, R=[r.capacity for r in self.resources],
        )


class SAParamsIn(BaseModel):
    t0: float = Field(50.0, gt=0, description="Initial temperature T0 (initial test value 50)")
    alpha: float = Field(0.95, gt=0, lt=1, description="Cooling rate (initial test value 0.95)")
    t_min: float = Field(0.01, gt=0, description="Minimum temperature (initial test value 0.01)")
    chain_length: int = Field(100, ge=1, le=100_000, description="Moves per temperature level")
    penalty_weight: Optional[float] = Field(None, gt=0, description="lambda; null = 10 x max v_j")
    seed: int = Field(42, ge=0, le=2**31 - 1)
    patience: int = Field(0, ge=0, description="Optional early stop (levels without improvement); 0 = off")

    @model_validator(mode="after")
    def _limits(self):
        if self.t0 <= self.t_min:
            raise ValueError("Initial temperature T0 must be greater than the minimum temperature Tmin.")
        if self.iterations > MAX_SA_ITERATIONS:
            raise ValueError(f"These parameters imply {self.iterations:,} iterations (limit {MAX_SA_ITERATIONS:,}). "
                             "Reduce chain length or increase the cooling rate.")
        return self

    @property
    def levels(self) -> int:
        return temperature_levels(self.t0, self.alpha, self.t_min)

    @property
    def iterations(self) -> int:
        return self.levels * self.chain_length

    def to_params(self, **over) -> SAParams:
        d = self.model_dump()
        d.update(over)
        return SAParams(**d)


class SARunRequest(BaseModel):
    problem: ProblemIn
    params: SAParamsIn = SAParamsIn()


class SAStreamRequest(SARunRequest):
    delay_ms: int = Field(20, ge=0, le=2000, description="Pause after each temperature level (live-demo pacing)")


class CompareRequest(SARunRequest):
    random_samples: Optional[int] = Field(None, ge=1, le=500_000,
                                          description="Random-feasible budget; null = same as SA evaluations")
    run_exact: bool = True


class ExactRequest(BaseModel):
    problem: ProblemIn


class ExperimentRequest(SARunRequest):
    n_runs: int = Field(30, ge=1, le=500)
    random_samples: Optional[int] = Field(None, ge=1, le=500_000)
    include_exact: bool = True

    @model_validator(mode="after")
    def _budget(self):
        if self.n_runs * self.params.iterations > MAX_TOTAL_ITERATIONS:
            raise ValueError("Experiment too large for the configured safety limit; reduce runs or SA iterations.")
        return self


class SensitivityRequest(SARunRequest):
    alphas: list[float] = Field([0.90, 0.95, 0.99], min_length=1, max_length=6)
    t0s: list[float] = Field([10, 50, 100, 200], min_length=1, max_length=6)
    runs_per_config: int = Field(3, ge=1, le=30)
    include_exact: bool = True

    @field_validator("alphas")
    @classmethod
    def _alphas(cls, v):
        if any(not (0 < a < 1) for a in v):
            raise ValueError("Every cooling rate must satisfy 0 < alpha < 1.")
        return v

    @field_validator("t0s")
    @classmethod
    def _t0s(cls, v):
        if any(t <= 0 for t in v):
            raise ValueError("Every initial temperature must be positive.")
        return v

    @model_validator(mode="after")
    def _budget(self):
        p = self.params
        total = sum(temperature_levels(t, a, p.t_min) * p.chain_length * self.runs_per_config
                    for a in self.alphas for t in self.t0s)
        if total > MAX_TOTAL_ITERATIONS:
            raise ValueError(f"Sensitivity grid implies {total:,} iterations (limit {MAX_TOTAL_ITERATIONS:,}).")
        return self


# ----------------------------------------------------------------------------- outputs
class MethodResultOut(BaseModel):
    key: str
    method: str
    allocation: list[int]
    utility: float
    energy: float
    feasible: bool
    usage: list[float]
    utilization: list[float]
    mean_utilization: float
    n_violations: int
    total_violation: float
    runtime_ms: float
    evaluations: Optional[int] = None
    optimality_gap_pct: Optional[float] = None
    note: str = ""


class SAStepOut(BaseModel):
    step: int
    iteration: int
    temperature: float
    current_energy: float
    current_utility: float
    current_feasible: bool
    best_utility: float
    best_energy: float
    accept_rate: float
    improving: int
    uphill: int
    rejected: int
    last_status: str


class SAStateOut(BaseModel):
    allocation: list[int]
    utility: float
    energy: float
    feasible: bool


class SAStatsOut(BaseModel):
    iterations: int
    levels: int
    accepted: int
    improving: int
    uphill_accepted: int
    rejected: int
    noop_moves: int
    infeasible_iterations: int
    runtime_ms: float
    stop_reason: str
    best_found_iteration: int
    min_energy_visited: float


class SARunOut(BaseModel):
    seed: int
    params: dict[str, Any]
    initial: SAStateOut
    final: SAStateOut
    best: MethodResultOut
    history: list[SAStepOut]
    stats: SAStatsOut
    exact_utility: Optional[float] = None


class ExactStatusOut(BaseModel):
    allowed: bool
    search_space: str
    search_space_log10: float
    limit: int
    reason: Optional[str] = None


class ExactOut(BaseModel):
    allocation: list[int]
    utility: float
    feasible_solutions: int
    nodes_visited: int
    search_space: int
    runtime_ms: float


class CompareOut(BaseModel):
    seed: int
    lam: float
    random_samples: int
    methods: list[MethodResultOut]
    sa_run: SARunOut
    exact: Optional[ExactOut] = None
    exact_status: ExactStatusOut
    best_method: str
    best_methods_tied: list[str]
    messages: list[str]


class ExactResponse(BaseModel):
    status: ExactStatusOut
    exact: Optional[ExactOut] = None
    compare: Optional[CompareOut] = None
