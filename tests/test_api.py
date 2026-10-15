import pytest
from fastapi.testclient import TestClient

from app.core.datasets import get_dataset
from app.main import app

client = TestClient(app)


def test_health_and_datasets():
    assert client.get("/api/health").json()["status"] == "ok"
    ds = {d["id"]: d for d in client.get("/api/datasets").json()}
    assert set(ds) == {"toy", "small", "medium", "large"}
    assert ds["small"]["exact_feasible"] and not ds["large"]["exact_feasible"]


def test_compare_small_includes_exact_and_correct_gap():
    r = client.post("/api/compare", json={"problem": get_dataset("small"), "params": {"seed": 7}})
    assert r.status_code == 200
    j = r.json()
    keys = [m["key"] for m in j["methods"]]
    assert keys == ["sa", "equal", "greedy", "random", "exact"]
    exact_u = j["exact"]["utility"]
    for m in j["methods"]:
        assert m["feasible"] and m["n_violations"] == 0
        assert m["utility"] <= exact_u + 1e-9
        assert m["optimality_gap_pct"] == pytest.approx((exact_u - m["utility"]) / exact_u * 100, abs=1e-9)


def test_compare_large_has_no_fabricated_gap():
    r = client.post("/api/compare", json={"problem": get_dataset("large"), "params": {"chain_length": 20}})
    j = r.json()
    assert j["exact"] is None and not j["exact_status"]["allowed"]
    assert all(m["optimality_gap_pct"] is None for m in j["methods"])
    assert "Exact optimum not computed for this instance." in j["exact_status"]["reason"]


def test_exact_endpoint_guard():
    assert client.post("/api/exact", json={"problem": get_dataset("medium")}).status_code == 422
    assert client.post("/api/exact", json={"problem": get_dataset("small")}).status_code == 200


def test_validation_errors_are_reported():
    bad = get_dataset("small")
    bad["projects"][0]["L"], bad["projects"][0]["U"] = 9, 3
    assert client.post("/api/sa/run", json={"problem": bad}).status_code == 422
    bad = get_dataset("small")
    bad["resources"][0]["capacity"] = -5
    assert client.post("/api/sa/run", json={"problem": bad}).status_code == 422
    bad = get_dataset("small")
    bad["consumption"][0][0] = -1
    assert client.post("/api/sa/run", json={"problem": bad}).status_code == 422
    bad = get_dataset("small")
    bad["projects"][0]["L"] = 2.5
    assert client.post("/api/sa/run", json={"problem": bad}).status_code == 422


def test_parameter_limits():
    r = client.post("/api/sa/run", json={"problem": get_dataset("small"), "params": {"alpha": 1.2}})
    assert r.status_code == 422
    r = client.post("/api/sa/run", json={"problem": get_dataset("small"), "params": {"alpha": 0.99999}})
    assert r.status_code == 422


def test_experiment_is_reproducible_and_reports_seeds():
    body = {"problem": get_dataset("small"), "params": {"seed": 500, "chain_length": 30}, "n_runs": 4,
            "random_samples": 200}
    a = client.post("/api/experiments/run", json=body).json()
    b = client.post("/api/experiments/run", json=body).json()
    assert a["seeds"] == [500, 501, 502, 503]
    assert [r["sa_utility"] for r in a["runs"]] == [r["sa_utility"] for r in b["runs"]]
    assert a["sa"]["utility"]["n"] == 4


def test_sensitivity_runs_real_grid():
    body = {"problem": get_dataset("toy"), "params": {"chain_length": 20}, "alphas": [0.9, 0.95], "t0s": [10, 50],
            "runs_per_config": 2}
    j = client.post("/api/sensitivity/run", json=body).json()
    assert len(j["configs"]) == 4
    assert j["best_config"]["label"].startswith("Best observed configuration")


def test_sse_stream_emits_start_steps_result():
    with client.stream("POST", "/api/sa/stream", json={"problem": get_dataset("toy"), "delay_ms": 0,
                                                       "params": {"chain_length": 10}}) as r:
        text = "".join(r.iter_text())
    events = [e for e in text.split("\n\n") if e.startswith("data: ")]
    assert '"type": "start"' in events[0]
    assert '"type": "result"' in events[-1]
    assert len(events) > 10
