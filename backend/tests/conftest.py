from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from conflict_sim.api.app import create_app, load_state
from conflict_sim.config import Config, default_config
from conflict_sim.estimation.__main__ import run
from conflict_sim.fixtures import write_fixture
from conflict_sim.io import load_indicators
from conflict_sim.simulation.artifacts import Artifacts
from conflict_sim.simulation.simulator import Simulator
from conflict_sim.transforms import Panel, build_panel

FIXTURES = Path(__file__).parent / "fixtures"
TEST_DRAWS = 200


@pytest.fixture(scope="session")
def cfg() -> Config:
    return default_config()


@pytest.fixture(scope="session")
def fixture_path() -> Path:
    path = FIXTURES / "indicators_sample.parquet"
    if not path.exists():
        write_fixture(FIXTURES)
    return path


@pytest.fixture(scope="session")
def truth(fixture_path: Path) -> dict[str, Any]:
    return json.loads((FIXTURES / "truth.json").read_text())


@pytest.fixture(scope="session")
def panel(cfg: Config, fixture_path: Path) -> Panel:
    long, _ = load_indicators(fixture_path)
    meta = pd.read_parquet(FIXTURES / "countries_sample.parquet").set_index("iso3")
    return build_panel(long, cfg, meta)


@pytest.fixture(scope="session")
def artifacts_dir(
    cfg: Config, fixture_path: Path, tmp_path_factory: pytest.TempPathFactory
) -> Path:
    out = tmp_path_factory.mktemp("artifacts")
    run(cfg, str(fixture_path), TEST_DRAWS, out)
    return out


@pytest.fixture(scope="session")
def artifacts(artifacts_dir: Path) -> Artifacts:
    return Artifacts.load(artifacts_dir)


@pytest.fixture(scope="session")
def simulator(panel: Panel, artifacts: Artifacts, cfg: Config) -> Simulator:
    return Simulator(panel, artifacts, cfg)


@pytest.fixture(scope="session")
def client(fixture_path: Path, artifacts_dir: Path) -> TestClient:
    return TestClient(create_app(load_state(source="fixture", artifacts_dir=artifacts_dir)))
