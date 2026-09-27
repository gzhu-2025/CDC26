"""Interface contract 2 (HTTP API). These models generate contracts/api/openapi.json.

Every response is an Envelope: {data, coverage, warnings, meta}.
Bands are per-year arrays aligned with `years`; quantiles are p5/p25/p50/p75/p95.
"""

from __future__ import annotations

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

from conflict_sim.warnings import Warn

T = TypeVar("T")

OutcomeName = Literal["gdp", "fdi"]
MeasureName = Literal["continuous", "onset"]


class IndicatorCoverage(BaseModel):
    n_obs: int = Field(description="non-null observations (country-years)")
    first_year: int | None
    last_year: int | None
    share: float = Field(description="share of sample years (1990-2023) with data, 0-1")


class BacktestSummary(BaseModel):
    n_episodes: int = Field(description="past wars replayed")
    hit_rate_90: float = Field(description="share whose actual GDP fell inside the 90% range")
    median_abs_log_err: float
    median_abs_log_err_no_war_model: float = Field(
        description="same error for a model that assumes the war had no effect"
    )


class Meta(BaseModel):
    source: str = Field(description="ingestion_pipeline | worldbank_dev_pull | synthetic_fixture")
    artifacts_created_at: str | None = None
    n_draws: int | None = None
    backtest: BacktestSummary | None = None
    note: str = "Associational estimates (two-way FE local projections), not causal effects."


class Envelope(BaseModel, Generic[T]):
    data: T
    coverage: dict[str, IndicatorCoverage] = Field(description="keyed by WB indicator code")
    warnings: list[Warn]
    meta: Meta


# ---------- /countries ----------
class CountryInfo(BaseModel):
    iso3: str
    name: str
    region: str | None = None
    income_level: str | None = None
    in_estimation_sample: bool
    coverage: dict[str, IndicatorCoverage]


# ---------- /history/{iso3} ----------
class History(BaseModel):
    iso3: str
    name: str
    years: list[int]
    battle_deaths: list[float | None]
    deaths_per_100k: list[float | None]
    conflict: list[bool | None] = Field(description=">= 25 battle deaths")
    onset: list[bool | None]
    gdp_pc: list[float | None] = Field(description="constant 2015 US$")
    fdi_pct_gdp: list[float | None]
    fdi_pct_gdp_ma3: list[float | None] = Field(description="winsorized, 3-yr trailing MA")
    poverty_rate: list[float | None]
    population: list[float | None]


# ---------- /simulate ----------
class SimulateRequest(BaseModel):
    iso3: str = Field(min_length=3, max_length=3, examples=["KEN"])
    onset_year: int = Field(ge=1991, le=2040, examples=[2025])
    duration_years: int = Field(ge=1, le=20, examples=[5])
    intensity_per_100k: float = Field(ge=0, le=2000, examples=[20.0])
    horizon: int = Field(default=10, ge=0, le=10)
    n_sims: int = Field(default=10_000, ge=100, le=50_000)
    seed: int | None = Field(default=None, description="same seed -> identical output")
    continue_existing_war: bool = Field(
        default=False,
        description="if the country is already at war, extend that war (diminishing damage) "
        "instead of simulating a new war on top of it",
    )


class Band(BaseModel):
    p5: list[float]
    p25: list[float]
    p50: list[float]
    p75: list[float]
    p95: list[float]


class Quantiles(BaseModel):
    p5: float
    p25: float
    p50: float
    p75: float
    p95: float


class OutcomeBands(BaseModel):
    unit: str
    gap_unit: str
    baseline: Band
    scenario: Band
    gap: Band
    actual: list[float | None] | None = Field(description="observed values, if in the past")


class Headline(BaseModel):
    year: int = Field(description="final simulated year (onset_year + horizon)")
    gdp_pc_gap_pct: Quantiles
    cumulative_gdp_pc_loss_usd: Quantiles
    fdi_gap_pp: Quantiles | None
    poverty_rate_gap_pp: Quantiles | None
    extra_people_in_poverty: Quantiles | None


class BaselineAssumptions(BaseModel):
    anchor_year: int
    gdp_growth_pct: float
    gdp_growth_sd_pct: float
    fdi_level_pct_gdp: float | None
    poverty_rate: float | None
    poverty_year: int | None
    population: float
    method: str = Field(description="how the no-war path was forecast")


class NeighborEffect(BaseModel):
    iso3: str
    name: str
    distance_km: float = Field(description="between capitals")
    weight: float = Field(description="exp(-distance / kernel_km)")
    gdp_pc_gap_pct: Quantiles = Field(description="% vs no-war path in the final year")
    gdp_pc_gap_pct_path: list[float] = Field(description="median, aligned with `years`")


class SimulationResult(BaseModel):
    iso3: str
    onset_year: int
    duration_years: int
    intensity_per_100k: float
    horizon: int
    n_sims: int
    seed: int | None
    measure: MeasureName
    years: list[int]
    conflict_years: list[int]
    gdp_pc: OutcomeBands
    fdi_pct_gdp: OutcomeBands | None
    poverty_rate: OutcomeBands | None
    poverty_headcount: OutcomeBands | None
    headline: Headline
    baseline_assumptions: BaselineAssumptions
    neighbors: list[NeighborEffect] = Field(
        default_factory=list, description="closest countries, most affected first"
    )


# ---------- /diagnostics/{outcome} ----------
class DiagnosticRow(BaseModel):
    h: int
    is_lead: bool = Field(description="pre-trend placebo (h < 0); should be ~0")
    beta: float
    se: float
    p_value: float
    ci_low: float
    ci_high: float
    boot_ci_low: float
    boot_ci_high: float
    nobs: int
    n_countries: int


class Diagnostics(BaseModel):
    outcome: OutcomeName
    measure: MeasureName
    unit: str
    leads: list[DiagnosticRow]
    path: list[DiagnosticRow]
    sanity: dict[str, object] | None = None


class Preset(BaseModel):
    key: str
    label: str = Field(examples=["Catastrophic war"])
    like: str = Field(examples=["Syria at its worst"])
    iso3: str
    start: int
    end: int
    duration_years: int
    intensity_per_100k: float = Field(description="mean battle deaths per 100k per year")


class ErrorBody(BaseModel):
    detail: str


# ---------- map + country panel ----------
Confidence = Literal["ok", "low", "none"]
ScaleType = Literal["sequential", "log", "diverging"]


class MapValue(BaseModel):
    value: float | None
    lo: float | None = Field(description="5th percentile (equals value for observed metrics)")
    hi: float | None = Field(description="95th percentile")
    confidence: Confidence
    as_of: str = Field(description="ACLED data date, YYYY-MM-DD")
    note: str | None = Field(default=None, description="why a value is null, if it is")


class MetricRow(MapValue):
    inputs: dict[str, object] = Field(description="data that went into this number")


class MetricInfo(BaseModel):
    name: str
    label: str
    unit: str
    meaning: str = Field(description="one line, plain language")
    scale: ScaleType


class FatalityPoint(BaseModel):
    month: str = Field(examples=["2026-08"])
    fatalities: float | None = Field(description="null before ACLED covers the country")


CountryStatus = Literal["at_war", "low_level", "calm", "unknown"]


class CountrySummary(BaseModel):
    iso3: str
    name: str
    population: float | None
    status: CountryStatus = Field(
        description="at_war: >= 25 UCDP-equivalent battle deaths in the last 12 months"
    )
    as_of: str
    confidence: Confidence
    headline: str
    metrics: dict[str, MetricRow]
    fatalities_36m: list[FatalityPoint]
    sources: list[str]


# ---------- /findings ----------
class HeroNumber(BaseModel):
    id: str
    value: float
    display: str = Field(description="rounded for display, e.g. '120,000'")
    text: str
    as_of: str


class FindingsSection(BaseModel):
    model_config = {"extra": "allow"}  # section-specific fields (stats, number, scorecard, ...)

    id: str
    heading: str = Field(description="sentence case")
    sentences: list[str] = Field(description="generated from templates, never hand-written")
    chart: dict[str, object] | None = Field(description="chart payload; 'type' selects the chart")
    how_we_know: str = Field(description="N, caveats and estimation date")
    sr_summary: str = Field(description="text alternative for the chart")


class Source(BaseModel):
    name: str
    detail: str
    use: str


class Findings(BaseModel):
    generated_at: str
    estimated_on: str
    acled_as_of: str
    lowo_on: str | None
    hero: list[HeroNumber]
    sections: list[FindingsSection]
    sources: list[Source]
