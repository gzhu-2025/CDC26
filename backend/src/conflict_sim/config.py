"""Typed loader for backend/config.yaml."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
DEFAULT_CONFIG = BACKEND_DIR / "config.yaml"

Measure = Literal["continuous", "onset"]


class Paths(BaseModel):
    indicators: list[str]
    countries: list[str]
    fixture: str
    artifacts: str


class Sample(BaseModel):
    start_year: int
    end_year: int
    min_population: float


class ConflictCfg(BaseModel):
    measure: Measure
    onset_threshold: float
    onset_peace_years: int
    missing_deaths_as_zero: bool
    merge_gap_years: int = 2
    intensity_scale: float = 1.0


class LPCfg(BaseModel):
    horizon_min: int
    horizon_max: int
    n_outcome_lags: int
    n_conflict_lags: int
    future_shock_controls: bool
    lead_base_offset: int
    ci_level: float
    duration_interaction: bool = True
    extra_terms_outcomes: list[str] = ["gdp"]

    @property
    def horizons(self) -> list[int]:
        return list(range(self.horizon_min, self.horizon_max + 1))


class FDICfg(BaseModel):
    ma_window: int
    winsor: tuple[float, float]


class BootstrapCfg(BaseModel):
    n_draws: int
    seed: int


class PovertyCfg(BaseModel):
    eta_low: float
    eta_high: float
    stale_after_years: int


class SimulationCfg(BaseModel):
    baseline_window: int
    fdi_baseline_window: int
    default_n_sims: int
    max_n_sims: int
    max_horizon: int
    min_gdp_years: int
    n_neighbors: int = 8
    baseline_method: Literal["arima", "trend"] = "arima"
    arima_window: int = 30
    arima_min_obs: int = 15


class SanityCfg(BaseModel):
    duration_years: int
    intensity_per_100k: float
    horizon: int
    gdp_gap_band: tuple[float, float]


class SpatialCfg(BaseModel):
    enabled: bool = True
    kernel_km: float = 500.0
    min_weight: float = 0.01
    n_spill_lags: int = 2


class BacktestCfg(BaseModel):
    min_onset_year: int = 1995
    min_intensity_per_100k: float = 2.0
    min_horizon: int = 3


class PresetCfg(BaseModel):
    key: str
    label: str
    like: str
    iso3: str
    start: int
    end: int


class Config(BaseModel):
    paths: Paths
    sample: Sample
    conflict: ConflictCfg
    lp: LPCfg
    fdi: FDICfg
    bootstrap: BootstrapCfg
    poverty: PovertyCfg
    simulation: SimulationCfg
    sanity: SanityCfg
    spatial: SpatialCfg = SpatialCfg()
    backtest: BacktestCfg = BacktestCfg()
    presets: list[PresetCfg] = []

    def resolve(self, p: str) -> Path:
        path = Path(p)
        return path if path.is_absolute() else (BACKEND_DIR / path).resolve()

    def first_existing(self, candidates: list[str]) -> Path | None:
        for c in candidates:
            path = self.resolve(c)
            if path.exists():
                return path
        return None

    @property
    def artifacts_dir(self) -> Path:
        return self.resolve(self.paths.artifacts)


def load_config(path: Path | str = DEFAULT_CONFIG) -> Config:
    with open(path, encoding="utf-8") as f:
        return Config.model_validate(yaml.safe_load(f))


@lru_cache(maxsize=1)
def default_config() -> Config:
    return load_config()
