"""FastAPI app. Run: uvicorn conflict_sim.api.app:app --reload  (from backend/).

Environment overrides: CONFLICT_SIM_SOURCE ('fixture' or parquet path),
CONFLICT_SIM_ARTIFACTS (artifacts directory).
"""

from __future__ import annotations

import json
import math
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from conflict_sim.api.schemas import (
    BacktestSummary,
    CountryInfo,
    DiagnosticRow,
    Diagnostics,
    Envelope,
    ErrorBody,
    History,
    IndicatorCoverage,
    MeasureName,
    Meta,
    OutcomeName,
    Preset,
    SimulateRequest,
    SimulationResult,
)
from conflict_sim.config import Config, default_config
from conflict_sim.contracts import DEATHS, FDI, GDP, INDICATORS, POP, POV
from conflict_sim.io import load_country_meta, load_indicators, resolve_indicators_path
from conflict_sim.simulation.artifacts import Artifacts
from conflict_sim.simulation.simulator import Simulator
from conflict_sim.transforms import Panel, build_panel, sample_mask
from conflict_sim.warnings import Warn

COLUMN_FOR = {DEATHS: "deaths", POP: "pop", GDP: "gdp", FDI: "fdi_raw", POV: "pov"}
UNITS = {
    "gdp": "log points per unit log1p(deaths/100k)",
    "fdi": "pp of GDP per unit log1p(deaths/100k)",
}
ONSET_UNITS = {"gdp": "log points per conflict onset", "fdi": "pp of GDP per conflict onset"}


@dataclass
class State:
    cfg: Config
    panel: Panel
    source: str
    names: pd.DataFrame | None
    artifacts: Artifacts | None
    simulator: Simulator | None
    backtest: BacktestSummary | None = None


def _coverage(df: pd.DataFrame, cfg: Config) -> dict[str, IndicatorCoverage]:
    years = df.index.get_level_values("year")
    in_window = (years >= cfg.sample.start_year) & (years <= cfg.sample.end_year)
    n_window = max(1, int(in_window.sum()))
    out = {}
    for code in INDICATORS:
        s = df[COLUMN_FOR[code]]
        if code == DEATHS:  # zeros were filled in; report only recorded deaths
            s = s.where(s > 0)
        obs = years[s.notna().to_numpy()]
        out[code] = IndicatorCoverage(
            n_obs=int(s.notna().sum()),
            first_year=int(obs.min()) if len(obs) else None,
            last_year=int(obs.max()) if len(obs) else None,
            share=round(float(s[in_window].notna().sum()) / n_window, 3),
        )
    return out


def _clean(values: pd.Series) -> list[Any]:
    return [None if (isinstance(v, float) and math.isnan(v)) else v for v in values.tolist()]


def _bools(values: pd.Series) -> list[bool | None]:
    return [None if math.isnan(v) else bool(v) for v in values.astype(float).tolist()]


def load_state(source: str | None = None, artifacts_dir: Path | None = None) -> State:
    cfg = default_config()
    source = source or os.environ.get("CONFLICT_SIM_SOURCE")
    path, label = resolve_indicators_path(cfg, source)
    long, _ = load_indicators(path)
    names = load_country_meta(cfg, path, label)
    panel = build_panel(long, cfg, names)
    art_dir = artifacts_dir or Path(os.environ.get("CONFLICT_SIM_ARTIFACTS", cfg.artifacts_dir))
    artifacts = Artifacts.load(art_dir) if Artifacts.exists(art_dir) else None
    sim = Simulator(panel, artifacts, cfg) if artifacts else None
    bt_path = art_dir / "backtest.json"
    backtest = (
        BacktestSummary.model_validate(json.loads(bt_path.read_text()))
        if artifacts and bt_path.exists()
        else None
    )
    return State(cfg, panel, label, names, artifacts, sim, backtest)


def create_app(state: State | None = None) -> FastAPI:
    app = FastAPI(
        title="Conflict Economic Impact Simulator",
        version="0.1.0",
        description=(
            "Local-projection estimates of how armed conflict is associated with GDP per "
            "capita, FDI and poverty, plus a Monte Carlo scenario simulator. Estimates are "
            "associational, not causal."
        ),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",  # any local dev server
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.sim = state

    def st() -> State:
        if app.state.sim is None:
            app.state.sim = load_state()
        return app.state.sim

    def meta(s: State) -> Meta:
        m = s.artifacts.meta if s.artifacts else {}
        return Meta(
            source=s.source,
            artifacts_created_at=m.get("created_at"),
            n_draws=m.get("n_draws"),
            backtest=s.backtest,
        )

    def global_warnings(s: State) -> list[Warn]:
        if s.artifacts and s.artifacts.meta.get("source") == "synthetic_fixture":
            return [Warn.synthetic()]
        return []

    def pretrend_warnings(s: State, outcome: str | None, measure: str) -> list[Warn]:
        if not s.artifacts:
            return []
        return [
            Warn.pretrend(p["outcome"], p["measure"], p["h"], p["p_value"])
            for p in s.artifacts.meta.get("pretrend_significant", [])
            if p["measure"] == measure and (outcome is None or p["outcome"] == outcome)
        ]

    def name_of(s: State, iso3: str) -> str:
        if s.names is not None and iso3 in s.names.index:
            return str(s.names.loc[iso3, "name"])
        return iso3

    def country_or_404(s: State, iso3: str) -> pd.DataFrame:
        iso3 = iso3.upper()
        if iso3 not in s.panel.countries:
            raise HTTPException(404, f"unknown country {iso3}")
        return s.panel.df.xs(iso3, level="iso3", drop_level=False)

    def require_artifacts(s: State) -> Artifacts:
        if s.artifacts is None or s.simulator is None:
            raise HTTPException(503, "estimation artifacts missing; run `make estimate`")
        return s.artifacts

    responses = {404: {"model": ErrorBody}, 503: {"model": ErrorBody}}

    @app.get("/countries", response_model=Envelope[list[CountryInfo]])
    def countries() -> Envelope[list[CountryInfo]]:
        s = st()
        mask = sample_mask(s.panel, s.cfg)
        in_sample = set(s.panel.df[mask].index.get_level_values("iso3"))
        out = []
        for iso3, df in s.panel.df.groupby(level="iso3"):
            row = s.names.loc[iso3] if s.names is not None and iso3 in s.names.index else None
            out.append(
                CountryInfo(
                    iso3=str(iso3),
                    name=name_of(s, str(iso3)),
                    region=None if row is None else row.get("region"),
                    income_level=None if row is None else row.get("income_level"),
                    in_estimation_sample=iso3 in in_sample,
                    coverage=_coverage(df, s.cfg),
                )
            )
        return Envelope(
            data=out,
            coverage=_coverage(s.panel.df, s.cfg),
            warnings=global_warnings(s),
            meta=meta(s),
        )

    @app.get("/history/{iso3}", response_model=Envelope[History], responses=responses)
    def history(iso3: str) -> Envelope[History]:
        s = st()
        df = country_or_404(s, iso3)
        iso3 = iso3.upper()
        cov = _coverage(df, s.cfg)
        warns = global_warnings(s)
        if cov[GDP].n_obs < s.cfg.simulation.min_gdp_years:
            warns.append(Warn.short_gdp(cov[GDP].n_obs, s.cfg.simulation.min_gdp_years))
        d = df.droplevel("iso3")
        data = History(
            iso3=iso3,
            name=name_of(s, iso3),
            years=d.index.tolist(),
            battle_deaths=_clean(d["deaths"]),
            deaths_per_100k=_clean(d["deaths_per_100k"]),
            conflict=_bools(d["conflict"]),
            onset=_bools(d["onset"]),
            gdp_pc=_clean(d["gdp"]),
            fdi_pct_gdp=_clean(d["fdi_raw"]),
            fdi_pct_gdp_ma3=_clean(d["fdi"]),
            poverty_rate=_clean(d["pov"]),
            population=_clean(d["pop"]),
        )
        return Envelope(data=data, coverage=cov, warnings=warns, meta=meta(s))

    @app.post(
        "/simulate",
        response_model=Envelope[SimulationResult],
        responses={**responses, 422: {"model": ErrorBody}},
    )
    async def simulate(req: SimulateRequest) -> Envelope[SimulationResult]:
        s = st()
        require_artifacts(s)
        df = country_or_404(s, req.iso3)
        assert s.simulator is not None
        try:
            result, warns = await run_in_threadpool(
                s.simulator.simulate,
                req.iso3.upper(),
                req.onset_year,
                req.duration_years,
                req.intensity_per_100k,
                req.horizon,
                req.n_sims,
                req.seed,
                req.continue_existing_war,
            )
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        warns = global_warnings(s) + pretrend_warnings(s, None, s.cfg.conflict.measure) + warns
        return Envelope(
            data=SimulationResult.model_validate(
                {
                    **result,
                    "neighbors": [
                        {**n, "name": name_of(s, n["iso3"])} for n in result["neighbors"]
                    ],
                }
            ),
            coverage=_coverage(df, s.cfg),
            warnings=warns,
            meta=meta(s),
        )

    @app.get("/diagnostics/{outcome}", response_model=Envelope[Diagnostics], responses=responses)
    def diagnostics(
        outcome: OutcomeName, measure: MeasureName = Query("continuous")
    ) -> Envelope[Diagnostics]:
        s = st()
        art = require_artifacts(s)
        rows = [DiagnosticRow.model_validate(r) for r in art.estimates[outcome][measure]]
        data = Diagnostics(
            outcome=outcome,
            measure=measure,
            unit=(UNITS if measure == "continuous" else ONSET_UNITS)[outcome],
            leads=[r for r in rows if r.is_lead],
            path=[r for r in rows if not r.is_lead],
            sanity=art.meta.get("sanity") if outcome == "gdp" else None,
        )
        mask = sample_mask(s.panel, s.cfg)
        return Envelope(
            data=data,
            coverage=_coverage(s.panel.df[mask], s.cfg),
            warnings=global_warnings(s) + pretrend_warnings(s, outcome, measure),
            meta=meta(s),
        )

    @app.get("/presets", response_model=Envelope[list[Preset]])
    def presets() -> Envelope[list[Preset]]:
        """Real past wars as reference scenarios, with intensity measured from the data."""
        s = st()
        out = []
        for p in s.cfg.presets:
            if p.iso3 not in s.panel.countries:
                continue
            d = s.panel.country(p.iso3).loc[p.start : p.end, "deaths_per_100k"]
            out.append(
                Preset(
                    **p.model_dump(),
                    duration_years=p.end - p.start + 1,
                    intensity_per_100k=round(float(d.fillna(0).mean()), 1),
                )
            )
        return Envelope(
            data=out,
            coverage=_coverage(s.panel.df, s.cfg),
            warnings=global_warnings(s),
            meta=meta(s),
        )

    @app.get("/health", include_in_schema=False)
    def health() -> dict[str, Any]:
        s = st()
        return {
            "ok": True,
            "source": s.source,
            "artifacts": s.artifacts is not None,
            "time": time.time(),
        }

    return app


app = create_app()
