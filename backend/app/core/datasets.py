"""Built-in datasets.  Every number is documented; nothing is random except the explicitly
seeded synthetic generator (same seed -> same instance)."""
from __future__ import annotations

import numpy as np

from .problem import Problem

RESOURCE_LIBRARY = [
    "Budget (₹ lakh)", "Manpower (person-days)", "Equipment hours", "Lab/compute hours",
    "Faculty hours", "Floor space (m²)", "Procurement slots", "Admin/support hours",
]

# (category, typical max benefit v, per-unit consumption profile over RESOURCE_LIBRARY)
CATEGORIES = [
    ("Infrastructure upgrade", 120, [8, 4, 3, 2, 1, 5, 2, 1]),
    ("Software platform", 100, [4, 7, 2, 3, 5, 1, 1, 2]),
    ("Research lab setup", 90, [7, 3, 8, 6, 3, 2, 4, 1]),
    ("Teaching innovation", 70, [2, 5, 1, 1, 6, 1, 2, 3]),
    ("Community outreach", 50, [2, 4, 1, 1, 3, 1, 1, 5]),
    ("Sustainability / energy", 85, [9, 3, 5, 2, 2, 4, 3, 1]),
    ("Student services", 60, [3, 5, 1, 2, 4, 1, 2, 4]),
    ("Industry collaboration", 95, [5, 4, 3, 5, 4, 2, 3, 2]),
]


def _build(name, resources, caps, rows) -> dict:
    """rows: (name, L, U, v, k, [a_i...]) -> ProblemIn-shaped dict."""
    return {
        "name": name,
        "projects": [{"name": r[0], "L": r[1], "U": r[2], "v": r[3], "k": r[4]} for r in rows],
        "resources": [{"name": rn, "capacity": c} for rn, c in zip(resources, caps)],
        "consumption": [[r[5][i] for r in rows] for i in range(len(resources))],
    }


def generate_instance(n_projects: int, n_resources: int, seed: int, tightness: float = 0.30,
                      name: str | None = None) -> dict:
    """Seeded synthetic portfolio.  Project categories supply realistic benefit/consumption profiles
    (multiplied by +-25-30 % noise); capacity R_i = tightness x sum_j a_ij U_j, so capacities bind
    (with tightness 0.30 roughly 30 % of the maximum possible demand can be served)."""
    if not (1 <= n_resources <= len(RESOURCE_LIBRARY)):
        raise ValueError(f"n_resources must be between 1 and {len(RESOURCE_LIBRARY)}.")
    if not (1 <= n_projects <= 200):
        raise ValueError("n_projects must be between 1 and 200.")
    rng = np.random.default_rng(seed)
    rows, counts = [], {}
    for j in range(n_projects):
        cat, base_v, prof = CATEGORIES[int(rng.integers(len(CATEGORIES)))] if j >= len(CATEGORIES) else CATEGORIES[j]
        counts[cat] = counts.get(cat, 0) + 1
        L = int(rng.integers(2, 5))
        U = L + int(rng.integers(6, 13))
        v = round(float(base_v * rng.uniform(0.75, 1.25)))
        k = round(float(rng.uniform(0.15, 0.50)), 2)
        a = [max(0.5, round(float(prof[i] * rng.uniform(0.7, 1.3)), 1)) for i in range(n_resources)]
        rows.append((f"{cat} {counts[cat]}", L, U, v, k, a))
    caps = []
    for i in range(n_resources):
        demand = sum(r[5][i] * r[2] for r in rows)
        floor_ = max(r[5][i] * r[1] for r in rows) * 1.2          # every single project can be funded alone
        caps.append(float(round(max(tightness * demand, floor_))))
    return _build(name or f"Synthetic portfolio (n={n_projects}, m={n_resources}, seed={seed})",
                  RESOURCE_LIBRARY[:n_resources], caps, rows)


def _toy() -> dict:
    # Review-1 report, section 3.3 (toy example, R = (100 budget, 120 person-days)).
    return _build("Review-1 toy example", ["Budget (₹ lakh)", "Manpower (person-days)"], [100, 120], [
        ("A", 2, 6, 40, 0.5, [10, 12]), ("B", 2, 6, 30, 0.4, [8, 10]),
        ("C", 3, 8, 50, 0.3, [12, 8]), ("D", 1, 5, 25, 0.6, [6, 15]),
    ])


def _small() -> dict:
    return _build("University project portfolio - small (n=5)", ["Budget (₹ lakh)", "Manpower (person-days)"],
                  [110, 170], [
        ("Smart Campus IoT", 2, 10, 100, 0.30, [6, 8]),
        ("Student Analytics Portal", 2, 9, 80, 0.40, [4, 10]),
        ("Library Digitisation", 1, 9, 55, 0.50, [3, 6]),
        ("Green Energy Audit", 2, 10, 70, 0.25, [8, 4]),
        ("Mobile Learning App", 2, 10, 90, 0.35, [5, 9]),
    ])


def _medium() -> dict:
    return _build("University project portfolio - medium (n=12)",
                  ["Budget (₹ lakh)", "Manpower (person-days)", "Equipment hours"], [300, 200, 150], [
        ("ERP Upgrade", 3, 12, 140, 0.22, [7, 5, 1]),
        ("Cloud Migration", 2, 10, 120, 0.30, [6, 4, 2]),
        ("Cybersecurity Hardening", 2, 8, 95, 0.40, [4, 3, 1]),
        ("Data Warehouse", 3, 12, 130, 0.25, [6, 6, 3]),
        ("AI Support Chatbot", 2, 9, 85, 0.35, [3, 4, 4]),
        ("Smart Lab Equipment", 2, 8, 75, 0.33, [8, 2, 6]),
        ("Campus Wi-Fi Expansion", 3, 10, 90, 0.28, [7, 3, 2]),
        ("E-Learning Content Studio", 2, 10, 70, 0.38, [2, 5, 1]),
        ("Alumni Portal", 1, 6, 45, 0.50, [2, 3, 1]),
        ("Solar Microgrid", 3, 10, 110, 0.20, [9, 3, 5]),
        ("Robotics Studio", 2, 8, 80, 0.32, [5, 4, 6]),
        ("Research Analytics Suite", 2, 9, 100, 0.30, [4, 5, 4]),
    ])


DATASETS: dict[str, dict] = {
    "toy": {
        "role": "Worked example",
        "description": "The 4-project toy example from the Review-1 report (section 3.3). Use it to check the "
                       "hand-calculation x=(3,0,4,2) -> U=83.49.",
        "build": _toy,
    },
    "small": {
        "role": "Exact validation",
        "description": "5 projects, 2 resources (budget, manpower). Small enough for exhaustive enumeration, so the "
                       "true optimum and SA's optimality gap can be computed.",
        "build": _small,
    },
    "medium": {
        "role": "SA demonstration",
        "description": "12 university projects, 3 resources (budget, manpower, equipment). Both budget and manpower "
                       "bind; exhaustive search is infeasible, so SA is compared with the baselines only.",
        "build": _medium,
    },
    "large": {
        "role": "Why heuristics matter",
        "description": "40 projects, 5 resources, generated with fixed seed 2026 from documented category profiles "
                       "(capacity = 30 % of maximum demand). The search space is astronomically large.",
        "build": lambda: generate_instance(40, 5, 2026, 0.30, "Synthetic portfolio - large (n=40, m=5)"),
    },
}


def get_dataset(dataset_id: str) -> dict:
    if dataset_id not in DATASETS:
        raise KeyError(dataset_id)
    return DATASETS[dataset_id]["build"]()


def problem_from_dict(d: dict) -> Problem:
    projects, resources = d["projects"], d["resources"]
    return Problem(
        name=d.get("name", "Custom"),
        project_names=[p["name"] for p in projects], resource_names=[r["name"] for r in resources],
        L=[p["L"] for p in projects], U=[p["U"] for p in projects],
        v=[p["v"] for p in projects], k=[p["k"] for p in projects],
        A=d["consumption"], R=[r["capacity"] for r in resources],
    )
