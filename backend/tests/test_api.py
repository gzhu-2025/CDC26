from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from conflict_sim.api.app import create_app, load_state
from conflict_sim.config import REPO_ROOT

ENVELOPE_KEYS = {"data", "coverage", "warnings", "meta"}
REQ = {
    "iso3": "KEN",
    "onset_year": 2024,
    "duration_years": 5,
    "intensity_per_100k": 20.0,
    "seed": 1,
}


def _check_envelope(body: dict) -> None:
    assert ENVELOPE_KEYS <= body.keys()
    assert isinstance(body["warnings"], list)
    assert "NY.GDP.PCAP.KD" in body["coverage"]


def test_countries(client: TestClient) -> None:
    r = client.get("/countries")
    assert r.status_code == 200
    body = r.json()
    _check_envelope(body)
    assert len(body["data"]) == 40
    ken = next(c for c in body["data"] if c["iso3"] == "KEN")
    assert ken["name"] == "Kenya" and ken["coverage"]["NY.GDP.PCAP.KD"]["n_obs"] > 20
    assert "SYNTHETIC_ESTIMATES" in {w["code"] for w in body["warnings"]}


def test_history(client: TestClient) -> None:
    body = client.get("/history/ken").json()
    _check_envelope(body)
    d = body["data"]
    assert len(d["years"]) == len(d["gdp_pc"]) == len(d["battle_deaths"])


def test_history_short_gdp_warning(client: TestClient) -> None:
    body = client.get("/history/LBR").json()
    assert "SHORT_GDP_HISTORY" in {w["code"] for w in body["warnings"]}


def test_simulate(client: TestClient) -> None:
    r = client.post("/simulate", json=REQ)
    assert r.status_code == 200, r.text
    body = r.json()
    _check_envelope(body)
    d = body["data"]
    assert len(d["years"]) == 11 and len(d["gdp_pc"]["gap"]["p50"]) == 11
    assert d["headline"]["gdp_pc_gap_pct"]["p50"] < 0
    assert client.post("/simulate", json=REQ).json() == body  # seeded -> deterministic


@pytest.mark.parametrize(
    "bad",
    [{"horizon": 11}, {"duration_years": 0}, {"intensity_per_100k": -1}, {"n_sims": 10}],
)
def test_simulate_validation(client: TestClient, bad: dict) -> None:
    assert client.post("/simulate", json={**REQ, **bad}).status_code == 422


def test_unknown_country_404(client: TestClient) -> None:
    assert client.get("/history/ZZZ").status_code == 404
    assert client.post("/simulate", json={**REQ, "iso3": "ZZZ"}).status_code == 404


@pytest.mark.parametrize("outcome", ["gdp", "fdi"])
@pytest.mark.parametrize("measure", ["continuous", "onset"])
def test_diagnostics(client: TestClient, outcome: str, measure: str) -> None:
    body = client.get(f"/diagnostics/{outcome}", params={"measure": measure}).json()
    _check_envelope(body)
    assert [r["h"] for r in body["data"]["leads"]] == [-3, -2, -1]
    assert [r["h"] for r in body["data"]["path"]] == list(range(11))


def test_simulate_neighbors_have_names(client: TestClient) -> None:
    body = client.post("/simulate", json={**REQ, "iso3": "UGA"}).json()
    nb = body["data"]["neighbors"]
    assert nb and all(n["name"] and n["name"] != n["iso3"] for n in nb)


def test_presets(client: TestClient) -> None:
    body = client.get("/presets").json()
    _check_envelope(body)
    for p in body["data"]:
        assert p["duration_years"] == p["end"] - p["start"] + 1
        assert p["intensity_per_100k"] >= 0


def test_missing_artifacts_503(tmp_path: Path) -> None:
    c = TestClient(create_app(load_state(source="fixture", artifacts_dir=tmp_path)))
    assert c.post("/simulate", json=REQ).status_code == 503
    assert c.get("/countries").status_code == 200


def test_openapi_contract_in_sync(client: TestClient) -> None:
    committed = REPO_ROOT / "contracts" / "api" / "openapi.json"
    assert committed.exists(), "run scripts/export_contracts.py"
    assert json.loads(committed.read_text()) == client.app.openapi(), (
        "contracts/api/openapi.json is stale; run scripts/export_contracts.py"
    )
