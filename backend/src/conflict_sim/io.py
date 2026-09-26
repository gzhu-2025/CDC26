"""Load and validate Contract-1 data."""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from conflict_sim.config import Config
from conflict_sim.contracts import WB_AGGREGATES, IndicatorsSchema

log = logging.getLogger(__name__)


def load_indicators(path: Path) -> tuple[pd.DataFrame, list[str]]:
    """Read the long-format Parquet, validate against the contract, drop aggregates."""
    warnings: list[str] = []
    raw = pd.read_parquet(path)
    df = IndicatorsSchema.validate(raw, lazy=True)
    aggregates = sorted(set(df["iso3"]) & WB_AGGREGATES)
    if aggregates:
        msg = f"Dropped {len(aggregates)} World Bank aggregate codes: {', '.join(aggregates)}"
        log.warning(msg)
        warnings.append(msg)
        df = df[~df["iso3"].isin(WB_AGGREGATES)]
    return df.reset_index(drop=True), warnings


def resolve_indicators_path(cfg: Config, source: str | None = None) -> tuple[Path, str]:
    """Pick the data file. ``source``: None (first existing), 'fixture', or an explicit path."""
    fixture = cfg.resolve(cfg.paths.fixture)
    if source == "fixture":
        path = fixture
    elif source:
        path = Path(source).resolve()
    else:
        path = cfg.first_existing(cfg.paths.indicators) or fixture
    if path == fixture:
        return path, "synthetic_fixture"
    if path.parent.name == "data":
        return path, "ingestion_pipeline"
    if path.parent.name == "dev_cache":
        return path, "worldbank_dev_pull"
    return path, "explicit_path"


def load_countries(cfg: Config) -> pd.DataFrame | None:
    path = cfg.first_existing(cfg.paths.countries)
    if path is None:
        return None
    df = pd.read_parquet(path)
    return df[~df["iso3"].isin(WB_AGGREGATES)].set_index("iso3")


def load_country_meta(cfg: Config, path: Path, label: str) -> pd.DataFrame | None:
    """Country names/coordinates matching the data source (the fixture ships its own)."""
    if label == "synthetic_fixture":
        p = path.parent / "countries_sample.parquet"
        return pd.read_parquet(p).set_index("iso3") if p.exists() else None
    return load_countries(cfg)
