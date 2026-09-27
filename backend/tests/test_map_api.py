from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from conflict_sim.acled import Acled
from conflict_sim.api.app import create_app, load_state
from conflict_sim.api.map_api import ISO_JOIN, NE_GEOJSON, headline, join_code
from conflict_sim.config import default_config
from conflict_sim.metrics import METRICS, acled_features

REAL_METRICS = default_config().artifacts_dir / "map_metrics.json"


def _row(v: float | None, lo: float | None = None, hi: float | None = None, conf: str = "ok"):
    return {
        "value": v,
        "lo": v if lo is None else lo,
        "hi": v if hi is None else hi,
        "confidence": "none" if v is None else conf,
        "as_of": "2026-09-12",
        "inputs": {},
    }


def _fake_metrics() -> dict:
    rows = {
        "KEN": {m: _row(1.0) for m in METRICS},
        "NOR": {m: _row(0.0) for m in METRICS}
        | {"peace_dividend_h5": {**_row(None), "note": "not applicable: not currently at war"}},
    }
    rows["KEN"]["cost_continue_h5"] = _row(-14.0, -24.0, -5.0)
    return {
        "as_of": "2026-09-12",
        "conversion": {"factor": 0.57, "africa_share": 0.68, "n_country_years": 537},
        "catalog": METRICS,
        "metrics": {m: {i: r[m] for i, r in rows.items()} for m in METRICS},
        "countries": {
            "KEN": {
                "name": "Kenya",
                "population": 5.5e7,
                "status": "at_war",
                "acled_coverage_start": "1997-01-04",
                "fatalities_36m": [{"month": "2026-08", "fatalities": 12.0}],
            },
            "NOR": {
                "name": "Norway",
                "population": 5.5e6,
                "status": "calm",
                "acled_coverage_start": "2018-01-06",
                "fatalities_36m": [],
            },
        },
    }


@pytest.fixture(scope="module")
def map_client(artifacts_dir: Path, tmp_path_factory: pytest.TempPathFactory) -> TestClient:
    art = tmp_path_factory.mktemp("map_art")
    for f in artifacts_dir.iterdir():
        shutil.copy(f, art / f.name)
    (art / "map_metrics.json").write_text(json.dumps(_fake_metrics()))
    return TestClient(create_app(load_state(source="fixture", artifacts_dir=art)))


def test_map_metrics_catalog(map_client: TestClient) -> None:
    body = map_client.get("/map/metrics").json()
    names = {m["name"]: m["scale"] for m in body["data"]}
    assert names["intensity_12m"] == "log"
    assert names["escalation_3m"] == names["unrest_z"] == "diverging"
    assert set(names) == set(METRICS)


def test_map_layer(map_client: TestClient) -> None:
    body = map_client.get("/map", params={"metric": "cost_continue_h5"}).json()
    assert body["data"]["KEN"] == {
        "value": -14.0,
        "lo": -24.0,
        "hi": -5.0,
        "confidence": "ok",
        "as_of": "2026-09-12",
        "note": None,
    }
    assert map_client.get("/map", params={"metric": "nope"}).status_code == 404


def test_country_summary(map_client: TestClient) -> None:
    body = map_client.get("/country/ken/summary").json()
    d = body["data"]
    assert d["name"] == "Kenya" and d["status"] == "at_war"
    assert d["headline"] == (
        "If current fighting continues five years, GDP per person is likely 5-24% lower "
        "than without war."
    )
    assert d["metrics"]["cost_continue_h5"]["lo"] == -24.0
    assert any("ACLED" in s for s in d["sources"])
    assert "CONVERTED_DEATHS" in {w["code"] for w in body["warnings"]}


def test_country_not_at_war_has_null_peace_dividend(map_client: TestClient) -> None:
    d = map_client.get("/country/NOR/summary").json()["data"]
    pd_ = d["metrics"]["peace_dividend_h5"]
    assert pd_["value"] is None and pd_["confidence"] == "none"
    assert "not applicable" in pd_["note"]


def test_country_without_data_is_200_none(map_client: TestClient) -> None:
    r = map_client.get("/country/ESH/summary")  # on the map, no data
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["confidence"] == "none" and d["status"] == "unknown"
    assert all(m["value"] is None for m in d["metrics"].values())
    assert d["name"] == "W. Sahara"


def test_unknown_country_404(map_client: TestClient) -> None:
    r = map_client.get("/country/ZZZ/summary")
    assert r.status_code == 404 and "ISO 3166" in r.json()["detail"]


def test_headline_wording() -> None:
    assert "range includes no loss" in headline("at_war", _row(-10.0, -26.0, 1.0))
    assert headline("calm", _row(0.0)).startswith("No significant")
    assert headline("unknown", None).startswith("There is not enough data")


# ---------- Natural Earth join ----------
def _features() -> list[dict]:
    return json.loads(NE_GEOJSON.read_text(encoding="utf-8"))["features"]


def test_join_uses_iso_a3_eh_and_overrides() -> None:
    overrides = json.loads(ISO_JOIN.read_text())["overrides"]
    by_name = {f["properties"]["NAME"]: join_code(f["properties"], overrides) for f in _features()}
    assert by_name["France"] == "FRA" and by_name["Norway"] == "NOR"  # ISO_A3 is -99 for these
    assert by_name["Kosovo"] == "XKX"
    assert by_name["Bahrain"] == "BHR"


@pytest.mark.skipif(not REAL_METRICS.exists(), reason="needs local ACLED + metrics batch")
def test_no_country_with_data_left_unjoined() -> None:
    iso = json.loads(ISO_JOIN.read_text())
    joined = {join_code(f["properties"], iso["overrides"]) for f in _features()}
    m = json.loads(REAL_METRICS.read_text())["metrics"]
    with_data = {i for rows in m.values() for i, r in rows.items() if r["value"] is not None}
    no_shape = {k for k in iso["no_shape_at_50m"] if not k.startswith("_")}
    missing = with_data - joined - no_shape
    assert not missing, f"countries with data but no map shape: {sorted(missing)}"
    assert "BHR" in with_data and "BHR" in joined


# ---------- ACLED feature math ----------
def _acled(weeks: int, fat: np.ndarray, unrest: np.ndarray) -> Acled:
    idx = pd.date_range("2020-01-04", periods=weeks, freq="7D")
    weekly = pd.DataFrame(
        {"pv_fat": fat, "battle_fat": fat, "unrest_ev": unrest},
        index=pd.MultiIndex.from_product([["AAA"], idx], names=["iso3", "week"]),
    )
    return Acled(weekly, pd.Series({"AAA": idx[0]}), idx[-1], [])


def test_escalation_and_unrest_math() -> None:
    n = 13 * 13
    fat = np.zeros(n)
    fat[-13:] = 3.0  # 39 deaths last quarter, 0 before
    unrest = np.ones(n)
    unrest[-13:] = 5.0
    f = acled_features(_acled(n, fat, unrest), "AAA")
    assert f["escalation"] == pytest.approx(np.log(40 / 1))
    assert f["unrest_z"] == 3.0  # flat history (sd 0) and a rise -> capped at +3
    assert f["pv_fat_12m"] == 39.0


def test_nan_before_coverage_not_zero() -> None:
    f = acled_features(_acled(20, np.ones(20), np.ones(20)), "AAA")  # < 1 year covered
    assert f["pv_fat_12m"] is None and f["unrest_z"] is None
    months = f["monthly"]
    assert months.index.min() >= pd.Timestamp("2020-01-01")
