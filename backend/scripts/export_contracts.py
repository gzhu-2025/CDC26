"""Write contracts/api/openapi.json and example responses for the frontend to mock against.

python scripts/export_contracts.py            # examples from the default data source
python scripts/export_contracts.py --fixture  # examples from the synthetic fixture
"""

from __future__ import annotations

import argparse
import json
from typing import Any

from fastapi.testclient import TestClient

from conflict_sim.api.app import create_app, load_state
from conflict_sim.config import REPO_ROOT

OUT = REPO_ROOT / "contracts" / "api"
SIM_REQUEST = {
    "iso3": "KEN",
    "onset_year": 2025,
    "duration_years": 5,
    "intensity_per_100k": 20.0,
    "horizon": 10,
    "n_sims": 10000,
    "seed": 42,
}


def _dump(name: str, body: Any) -> None:
    (OUT / "examples" / name).write_text(json.dumps(body, indent=2) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", action="store_true")
    args = ap.parse_args()
    app = create_app(load_state(source="fixture" if args.fixture else None))
    (OUT / "examples").mkdir(parents=True, exist_ok=True)
    (OUT / "openapi.json").write_text(json.dumps(app.openapi(), indent=2) + "\n")

    c = TestClient(app)
    countries = c.get("/countries").json()
    countries["data"] = [d for d in countries["data"] if d["iso3"] in {"KEN", "SYR", "UKR"}]
    _dump("countries.json", countries)
    _dump("history_KEN.json", c.get("/history/KEN").json())
    _dump("simulate_request.json", SIM_REQUEST)
    _dump("simulate_response.json", c.post("/simulate", json=SIM_REQUEST).json())
    _dump("diagnostics_gdp.json", c.get("/diagnostics/gdp").json())
    _dump("error_404.json", c.get("/history/ZZZ").json())
    if c.get("/map/metrics").status_code == 200:  # needs artifacts/map_metrics.json
        _dump("map_metrics.json", c.get("/map/metrics").json())
        layer = c.get("/map", params={"metric": "intensity_12m"}).json()
        layer["data"] = {
            k: v for k, v in layer["data"].items() if k in {"UKR", "SDN", "NOR", "BHR", "ESH"}
        }
        _dump("map_intensity_12m.json", layer)
        _dump("country_UKR_summary.json", c.get("/country/UKR/summary").json())
        _dump("country_ESH_summary_no_data.json", c.get("/country/ESH/summary").json())
    if c.get("/findings").status_code == 200:  # needs artifacts/findings.json
        _dump("findings.json", c.get("/findings").json())
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
