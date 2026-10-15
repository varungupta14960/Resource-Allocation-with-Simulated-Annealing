"""Feasibility-aware neighbourhood: transfer / adjust / toggle with the snapping rule.

Every neighbour stays inside the viability domain {0} U [L_j, U_j] *by construction*:
    * decreasing a project below L_j snaps it to 0,
    * increasing an inactive project snaps it to L_j.
Resource-capacity violations are allowed and handled by the energy penalty.
"""
from __future__ import annotations

import random
from typing import Optional, Sequence

Move = list[tuple[int, int]]   # [(project index, new value), ...]

P_TRANSFER = 0.50
P_ADJUST = 0.35      # remaining 0.15 -> toggle


def propose_move(x: Sequence[int], L: Sequence[int], U: Sequence[int], rnd: random.Random,
                 p_transfer: float = P_TRANSFER, p_adjust: float = P_ADJUST) -> Move:
    """Return a list of (j, new_value) changes (always non-empty and always different from x)."""
    n = len(x)
    for _ in range(12):
        r = rnd.random()
        if r < p_transfer:                                   # ---- transfer: move d in {1,2} units p -> q
            if n < 2:
                continue
            actives = [j for j in range(n) if x[j] > 0]
            if not actives:
                continue
            p = actives[rnd.randrange(len(actives))]
            q = rnd.randrange(n - 1)
            if q >= p:
                q += 1
            d = rnd.randint(1, 2)
            new_p = x[p] - d
            if new_p < L[p]:
                new_p = 0                                    # snap down
            new_q = max(L[q], d) if x[q] == 0 else x[q] + d  # snap up when activating
            if new_q > U[q]:
                new_q = U[q]
            if new_q == x[q]:
                continue
            return [(p, new_p), (q, new_q)]
        if r < p_transfer + p_adjust:                        # ---- adjust: +-1 unit on one project
            j = rnd.randrange(n)
            if rnd.random() < 0.5:
                if x[j] == 0:
                    nv = L[j]
                elif x[j] < U[j]:
                    nv = x[j] + 1
                else:
                    continue
            else:
                if x[j] == 0:
                    continue
                nv = x[j] - 1
                if nv < L[j]:
                    nv = 0
            return [(j, nv)]
        j = rnd.randrange(n)                                 # ---- toggle: activate at L_j or deactivate
        return [(j, 0 if x[j] > 0 else L[j])]
    j = rnd.randrange(n)                                     # fallback: a toggle is always a valid change
    return [(j, 0 if x[j] > 0 else L[j])]


def apply_move(x: Sequence[int], move: Move) -> list[int]:
    y = list(x)
    for j, v in move:
        y[j] = v
    return y


def neighbour(x: Sequence[int], L: Sequence[int], U: Sequence[int], rnd: random.Random) -> Optional[list[int]]:
    """Convenience wrapper returning the neighbouring allocation (or None if no move exists)."""
    mv = propose_move(x, L, U, rnd)
    return apply_move(x, mv) if mv else None
