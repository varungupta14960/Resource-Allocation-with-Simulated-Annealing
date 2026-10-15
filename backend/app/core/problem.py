"""Mathematical model of the resource-allocation problem (Review-1 formulation).

Decision variable   x_j  in {0} U [L_j, U_j], integer
Utility             u_j(x_j) = 0                      if x_j = 0
                              v_j (1 - exp(-k_j x_j)) if L_j <= x_j <= U_j
Constraints         sum_j a_ij x_j <= R_i             for every resource i
Energy              E(x) = -U(x) + lambda * sum_i max(0, (sum_j a_ij x_j - R_i) / R_i)
"""
from __future__ import annotations

import math
from typing import Sequence

from ..config import TOL


class Problem:
    """Immutable-by-convention problem instance with pre-computed lookup tables."""

    def __init__(self, *, name: str, project_names: Sequence[str], resource_names: Sequence[str],
                 L: Sequence[int], U: Sequence[int], v: Sequence[float], k: Sequence[float],
                 A: Sequence[Sequence[float]], R: Sequence[float]):
        self.name = name
        self.project_names = list(project_names)
        self.resource_names = list(resource_names)
        self.L = [int(a) for a in L]
        self.U = [int(a) for a in U]
        self.v = [float(a) for a in v]
        self.k = [float(a) for a in k]
        self.A = [[float(a) for a in row] for row in A]      # m x n
        self.R = [float(a) for a in R]
        self.n = len(self.L)
        self.m = len(self.R)
        self._check()
        # Lookup table: util_table[j][x] = u_j(x) (entries between 1 and L_j-1 are never used).
        self.util_table = [
            [0.0] + [self.v[j] * (1.0 - math.exp(-self.k[j] * x)) for x in range(1, self.U[j] + 1)]
            for j in range(self.n)
        ]
        self.A_cols = [[self.A[i][j] for i in range(self.m)] for j in range(self.n)]
        self.R_inv = [1.0 / r for r in self.R]

    # ------------------------------------------------------------------ validation
    def _check(self) -> None:
        n, m = self.n, self.m
        if n < 1 or m < 1:
            raise ValueError("A problem needs at least one project and one resource.")
        for name, seq in (("U", self.U), ("v", self.v), ("k", self.k), ("project_names", self.project_names)):
            if len(seq) != n:
                raise ValueError(f"Length of {name} must equal the number of projects ({n}).")
        if len(self.resource_names) != m:
            raise ValueError("Length of resource_names must equal the number of resources.")
        if len(self.A) != m or any(len(row) != n for row in self.A):
            raise ValueError(f"Consumption matrix must be {m} x {n} (resources x projects).")
        for j in range(n):
            if self.L[j] < 1 or self.U[j] < self.L[j]:
                raise ValueError(f"Project {j + 1}: need 1 <= L <= U.")
            if self.v[j] <= 0 or self.k[j] <= 0:
                raise ValueError(f"Project {j + 1}: v and k must be positive.")
        if any(r <= 0 for r in self.R):
            raise ValueError("Resource capacities must be strictly positive.")
        if any(a < 0 for row in self.A for a in row):
            raise ValueError("Resource consumption a_ij must be non-negative.")

    # ------------------------------------------------------------------ model functions
    def default_penalty(self) -> float:
        """lambda = 10 x max_j v_j  (initial test value from the project methodology)."""
        return 10.0 * max(self.v)

    def in_domain(self, x: Sequence[int]) -> bool:
        """x_j in {0} U [L_j, U_j] for every j (integers only)."""
        if len(x) != self.n:
            return False
        for j, xj in enumerate(x):
            if int(xj) != xj:
                return False
            if xj != 0 and not (self.L[j] <= xj <= self.U[j]):
                return False
        return True

    def project_utility(self, j: int, xj: int) -> float:
        if xj == 0:
            return 0.0
        if not (self.L[j] <= xj <= self.U[j]):
            raise ValueError(f"x_{j + 1}={xj} is outside the domain {{0}} U [{self.L[j]}, {self.U[j]}].")
        return self.util_table[j][int(xj)]

    def utility(self, x: Sequence[int]) -> float:
        """U(x) = sum_j u_j(x_j)."""
        if len(x) != self.n:
            raise ValueError("Allocation length does not match number of projects.")
        return sum(self.project_utility(j, int(xj)) for j, xj in enumerate(x))

    def usage(self, x: Sequence[int]) -> list[float]:
        """Resource consumption  sum_j a_ij x_j  for each resource i."""
        return [sum(self.A[i][j] * x[j] for j in range(self.n)) for i in range(self.m)]

    def relative_violations(self, x: Sequence[int]) -> list[float]:
        """max(0, (usage_i - R_i) / R_i) for each resource (0 when within tolerance)."""
        out = []
        for u, r in zip(self.usage(x), self.R):
            ex = u - r
            out.append(ex / r if ex > TOL else 0.0)
        return out

    def penalty(self, x: Sequence[int], lam: float) -> float:
        return lam * sum(self.relative_violations(x))

    def energy(self, x: Sequence[int], lam: float) -> float:
        """E(x) = -U(x) + lambda * sum_i max(0, (usage_i - R_i) / R_i)."""
        return -self.utility(x) + self.penalty(x, lam)

    def is_resource_feasible(self, x: Sequence[int]) -> bool:
        return all(u <= r + TOL for u, r in zip(self.usage(x), self.R))

    def is_feasible(self, x: Sequence[int]) -> bool:
        """Feasible = inside the integer domain AND within every resource capacity."""
        return self.in_domain(x) and self.is_resource_feasible(x)

    def utilization(self, x: Sequence[int]) -> list[float]:
        """rho_i = usage_i / R_i."""
        return [u / r for u, r in zip(self.usage(x), self.R)]

    # ------------------------------------------------------------------ helpers
    def max_feasible_value(self, j: int, usage: Sequence[float]) -> int:
        """Largest x_j <= U_j that still fits given the current resource usage (may be < L_j)."""
        best = self.U[j]
        for i in range(self.m):
            a = self.A[i][j]
            if a > TOL:
                best = min(best, math.floor((self.R[i] - usage[i]) / a + TOL))
        return best

    def search_space_size(self) -> int:
        """Raw size of the discrete search space  prod_j (U_j - L_j + 2)."""
        size = 1
        for l, u in zip(self.L, self.U):
            size *= (u - l + 2)
        return size
