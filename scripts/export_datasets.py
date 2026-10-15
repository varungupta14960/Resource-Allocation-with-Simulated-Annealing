"""Export the built-in datasets to data/datasets/*.json (the backend serves the same definitions)."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "backend"))
from app.core.datasets import DATASETS, get_dataset

out = pathlib.Path(__file__).resolve().parents[1] / "data" / "datasets"
out.mkdir(parents=True, exist_ok=True)
for k in DATASETS:
    (out / f"{k}.json").write_text(json.dumps({"id": k, "role": DATASETS[k]["role"], "description": DATASETS[k]["description"], "problem": get_dataset(k)}, indent=2, ensure_ascii=False), encoding="utf-8")
    print("wrote", k)
