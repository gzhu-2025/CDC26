"""Map metrics batch: one row per iso3 per metric -> artifacts/map_metrics.json.

    python -m conflict_sim.metrics

ACLED metrics (NaN before a country's ACLED coverage, never 0):
    intensity_12m   political-violence fatalities per 100k people, last 52 weeks
    escalation_3m   log((fatalities last 13 wk + 1) / (previous 13 wk + 1))
    unrest_z        (protests + riots last 13 wk - 3-yr mean) / 3-yr sd, capped at +/-3
Engine metrics (simulator draws, n_sims=10000, fixed seed):
    cost_continue_h5   GDP pc gap at h=5 if current intensity continues 5 years
    peace_dividend_h5  gap(continues 5 yrs) - gap(stops after current year), paired draws;
                       null ("not applicable") for countries not currently at war
    extra_poor_h5      extra people below the poverty line at h=5
    neighbor_exposure  GDP pc gap at h=5 from neighbors' current fighting persisting

Unit conversion: the engine is calibrated on UCDP battle deaths per 100k. ACLED Battles +
Explosions/Remote violence fatalities (UCDP scope: no violence against civilians) are
scaled by exp(median log(UCDP / ACLED)) fitted on overlapping country-years.

Confidence: "low" if the 90% band is wider than |median|, ACLED coverage < 3 years, or (engine
metrics only) GDP is missing for the last 2 data years; "none" if the value is null; else "ok".
"""

from __future__ import annotations

import argparse
import json
import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from conflict_sim.acled import Acled, load_acled
from conflict_sim.config import Config, default_config
from conflict_sim.io import load_countries, load_indicators, resolve_indicators_path
from conflict_sim.simulation.artifacts import Artifacts
from conflict_sim.simulation.simulator import Simulator, superposition_matrix
from conflict_sim.transforms import Panel, build_panel, intensity_to_x

log = logging.getLogger(__name__)

N_SIMS = 10_000
SEED = 20260926
HORIZON = 5
WAR_THRESHOLD = 25  # UCDP-equivalent battle deaths per year
QUARTER = 13  # weeks

METRICS: dict[str, dict[str, str]] = {
    "intensity_12m": {
        "label": "Deadly violence",
        "unit": "deaths per 100k people, last 12 months",
        "meaning": "How many people were killed in political violence, relative to population.",
        "scale": "log",
    },
    "escalation_3m": {
        "label": "Escalation",
        "unit": "change vs previous 3 months (log ratio)",
        "meaning": "Whether killings rose or fell in the last 3 months compared with the 3 before.",
        "scale": "diverging",
    },
    "unrest_z": {
        "label": "Unrest signal",
        "unit": "standard deviations from the 3-year norm",
        "meaning": "Protests and riots in the last 3 months vs the country's usual level.",
        "scale": "diverging",
    },
    "cost_continue_h5": {
        "label": "Cost if fighting continues",
        "unit": "% GDP per person after 5 years",
        "meaning": "How much poorer people would be in 5 years if today's fighting continued.",
        "scale": "sequential",
    },
    "peace_dividend_h5": {
        "label": "Gain from stopping now",
        "unit": "% points of GDP per person after 5 years",
        "meaning": (
            "How much income is saved if fighting stops after this year instead of 4 more years."
        ),
        "scale": "sequential",
    },
    "extra_poor_h5": {
        "label": "People pushed into poverty",
        "unit": "people below $2.15/day after 5 years",
        "meaning": ("Extra people in extreme poverty if today's fighting continued for 5 years."),
        "scale": "log",
    },
    "neighbor_exposure": {
        "label": "Neighborhood exposure",
        "unit": "% GDP per person after 5 years",
        "meaning": "Income lost because of fighting in nearby countries, if it continues.",
        "scale": "sequential",
    },
}


@dataclass(frozen=True)
class Conversion:
    factor: float
    median_log_ratio: float
    iqr_log_ratio: tuple[float, float]
    n_country_years: int
    n_countries: int
    africa_share: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "factor": self.factor,
            "median_log_ratio": self.median_log_ratio,
            "iqr_log_ratio": list(self.iqr_log_ratio),
            "factor_iqr": [float(np.exp(v)) for v in self.iqr_log_ratio],
            "n_country_years": self.n_country_years,
            "n_countries": self.n_countries,
            "africa_share": self.africa_share,
            "note": (
                "UCDP-equivalent battle deaths = factor x ACLED (Battles + Explosions/Remote "
                "violence) fatalities; fitted as the median log ratio on overlapping "
                "country-years (UCDP >= 25), mostly African wars."
            ),
        }


def fit_conversion(acled: Acled, long: pd.DataFrame) -> Conversion:
    w = acled.weekly.reset_index()
    w["year"] = w["week"].dt.year
    annual = w.groupby(["iso3", "year"])["battle_fat"].sum().rename("acled")
    ucdp = long[long["indicator"] == "VC.BTL.DETH"].dropna().set_index(["iso3", "year"])["value"]
    j = pd.concat([annual, ucdp.rename("ucdp")], axis=1, join="inner").reset_index()
    first_full = acled.coverage_start.dt.year + 1
    j = j[(j["year"] >= j["iso3"].map(first_full)) & (j["acled"] > 0) & (j["ucdp"] >= 25)]
    lr = np.log(j["ucdp"] / j["acled"])
    africa = set(acled.coverage_start[acled.coverage_start.dt.year <= 1997].index)
    return Conversion(
        factor=float(np.exp(lr.median())),
        median_log_ratio=float(lr.median()),
        iqr_log_ratio=(float(lr.quantile(0.25)), float(lr.quantile(0.75))),
        n_country_years=len(j),
        n_countries=int(j["iso3"].nunique()),
        africa_share=float(j["iso3"].isin(africa).mean()),
    )


def _row(
    value: float | None,
    lo: float | None,
    hi: float | None,
    confidence: str,
    as_of: str,
    inputs: dict[str, Any],
    note: str | None = None,
) -> dict[str, Any]:
    clean = lambda v: None if v is None or not np.isfinite(v) else float(v)  # noqa: E731
    value = clean(value)
    return {
        "value": value,
        "lo": clean(lo),
        "hi": clean(hi),
        "confidence": "none" if value is None else confidence,
        "as_of": as_of,
        "inputs": inputs,
        **({"note": note} if note else {}),
    }


def _band_conf(med: float, lo: float, hi: float, base_low: bool) -> str:
    return "low" if base_low or (hi - lo) > abs(med) else "ok"


def acled_features(acled: Acled, iso3: str) -> dict[str, Any]:
    d = acled.country(iso3)
    n = len(d)
    last52 = d.iloc[-52:] if n >= 52 else None
    q1 = d.iloc[-QUARTER:] if n >= QUARTER else None
    q0 = d.iloc[-2 * QUARTER : -QUARTER] if n >= 2 * QUARTER else None
    unrest_z = None
    need = QUARTER * 13  # current quarter + 12 prior quarters (3 years)
    if n >= need:
        u = d["unrest_ev"].to_numpy()
        cur = u[-QUARTER:].sum()
        hist = u[-need:-QUARTER].reshape(12, QUARTER).sum(axis=1)
        sd = hist.std(ddof=1)
        z = (
            (cur - hist.mean()) / sd
            if sd > 0
            else (0.0 if cur == hist.mean() else np.sign(cur - hist.mean()) * 3)
        )
        unrest_z = float(np.clip(z, -3, 3))
    monthly = d["pv_fat"].resample("MS").sum()
    return {
        "weeks_covered": n,
        "coverage_years": n / 52.18,
        "pv_fat_12m": None if last52 is None else float(last52["pv_fat"].sum()),
        "battle_fat_12m": None if last52 is None else float(last52["battle_fat"].sum()),
        "escalation": None
        if q0 is None
        else float(np.log((q1["pv_fat"].sum() + 1) / (q0["pv_fat"].sum() + 1))),
        "pv_last3m": None if q1 is None else float(q1["pv_fat"].sum()),
        "pv_prev3m": None if q0 is None else float(q0["pv_fat"].sum()),
        "unrest_z": unrest_z,
        "monthly": monthly,
    }


def _series_36m(monthly: pd.Series, as_of: pd.Timestamp) -> list[dict[str, Any]]:
    months = pd.date_range(end=as_of.to_period("M").to_timestamp(), periods=36, freq="MS")
    s = monthly.reindex(months)  # NaN before coverage stays NaN
    return [
        {"month": m.strftime("%Y-%m"), "fatalities": None if pd.isna(v) else float(v)}
        for m, v in s.items()
    ]


def build_metrics(
    cfg: Config,
    panel: Panel,
    sim: Simulator,
    acled: Acled,
    conv: Conversion,
    names: pd.DataFrame | None,
) -> dict[str, Any]:
    as_of = acled.as_of
    as_of_s = as_of.date().isoformat()
    onset = as_of.year
    df = panel.df
    last_gdp_years = sorted(df["gdp"].dropna().index.get_level_values("year").unique())[-2:]
    iso_all = sorted(set(panel.countries) | set(acled.countries))

    pop_latest: dict[str, float] = {}
    for iso3 in panel.countries:
        s = panel.country(iso3)["pop"].dropna()
        if len(s):
            pop_latest[iso3] = float(s.iloc[-1])

    feats = {iso3: acled_features(acled, iso3) for iso3 in acled.countries}
    equiv: dict[str, float] = {}  # UCDP-equivalent battle deaths per 100k per year
    for iso3, f in feats.items():
        pop = pop_latest.get(iso3)
        if pop and f["battle_fat_12m"] is not None:
            equiv[iso3] = f["battle_fat_12m"] * conv.factor / pop * 1e5
    at_war = {
        iso3
        for iso3, f in feats.items()
        if f["battle_fat_12m"] is not None and f["battle_fat_12m"] * conv.factor >= WAR_THRESHOLD
    }

    out: dict[str, dict[str, Any]] = {m: {} for m in METRICS}
    countries: dict[str, Any] = {}

    # neighbor exposure inputs: current x_j for every country with an ACLED-based intensity
    W = panel.weights
    x_now = pd.Series(
        {i: float(intensity_to_x(v, cfg.conflict.intensity_scale)) for i, v in equiv.items()}
    )

    for iso3 in iso_all:
        f = feats.get(iso3)
        pop = pop_latest.get(iso3)
        short_cov = f is None or f["coverage_years"] < 3
        gdp_missing = (
            iso3 not in panel.countries
            or panel.country(iso3)["gdp"].reindex(last_gdp_years).isna().all()
        )
        base_inputs = {
            "acled_coverage_start": None
            if f is None
            else acled.coverage_start[iso3].date().isoformat(),
            "population": pop,
        }
        # ---- ACLED metrics ----
        if f is not None and pop and f["pv_fat_12m"] is not None:
            v = f["pv_fat_12m"] / pop * 1e5
            out["intensity_12m"][iso3] = _row(
                v,
                v,
                v,
                "low" if short_cov else "ok",
                as_of_s,
                {**base_inputs, "pv_fatalities_12m": f["pv_fat_12m"]},
            )
        else:
            out["intensity_12m"][iso3] = _row(None, None, None, "none", as_of_s, base_inputs)
        esc = None if f is None else f["escalation"]
        out["escalation_3m"][iso3] = _row(
            esc,
            esc,
            esc,
            "low" if short_cov else "ok",
            as_of_s,
            {
                **base_inputs,
                "fatalities_last_3m": None if f is None else f["pv_last3m"],
                "fatalities_prev_3m": None if f is None else f["pv_prev3m"],
            },
        )
        uz = None if f is None else f["unrest_z"]
        out["unrest_z"][iso3] = _row(uz, uz, uz, "low" if short_cov else "ok", as_of_s, base_inputs)

        # ---- engine metrics ----
        intensity = equiv.get(iso3)
        eng_inputs = {
            **base_inputs,
            "acled_battle_fatalities_12m": None if f is None else f["battle_fat_12m"],
            "ucdp_equivalent_factor": conv.factor,
            "intensity_per_100k_ucdp_equiv": intensity,
            "onset_year": onset,
            "calibration": f"median log ratio on {conv.n_country_years} country-years "
            f"({conv.africa_share:.0%} Africa)",
        }
        eng_low = short_cov or gdp_missing
        runnable = intensity is not None and iso3 in panel.countries
        null = _row(None, None, None, "none", as_of_s, eng_inputs)
        if not runnable:
            for m in ("cost_continue_h5", "peace_dividend_h5", "extra_poor_h5"):
                out[m][iso3] = null
        else:
            if intensity > 0:
                draws = sim.effect_draws(5, HORIZON, intensity, N_SIMS, SEED)["own"]
                cont = np.expm1(draws[:, HORIZON]) * 100
            else:
                cont = np.zeros(N_SIMS)
            q = np.percentile(cont, [5, 50, 95])
            out["cost_continue_h5"][iso3] = _row(
                q[1], q[0], q[2], _band_conf(q[1], q[0], q[2], eng_low), as_of_s, eng_inputs
            )
            if iso3 in at_war:
                stop = (
                    np.expm1(
                        sim.effect_draws(1, HORIZON, intensity, N_SIMS, SEED)["own"][:, HORIZON]
                    )
                    * 100
                )
                gain = stop - cont  # paired draws: positive = income saved by stopping now
                g = np.percentile(gain, [5, 50, 95])
                out["peace_dividend_h5"][iso3] = _row(
                    g[1], g[0], g[2], _band_conf(g[1], g[0], g[2], eng_low), as_of_s, eng_inputs
                )
            else:
                out["peace_dividend_h5"][iso3] = _row(
                    None,
                    None,
                    None,
                    "none",
                    as_of_s,
                    eng_inputs,
                    note="not applicable: not currently at war",
                )
            poor = None
            poor_note = "no poverty data"
            if intensity > 0:
                try:
                    res, warns = sim.simulate(
                        iso3, onset, 5, intensity, horizon=HORIZON, n_sims=N_SIMS, seed=SEED
                    )
                    poor = res["headline"]["extra_people_in_poverty"]
                    if any(w.code == "STALE_POVERTY_DATA" for w in warns):
                        # old survey + big GDP moves push both paths into the 0/100% clip
                        survey = res["baseline_assumptions"]["poverty_year"]
                        poor, poor_note = None, f"poverty survey too old ({survey})"
                except (ValueError, KeyError):
                    poor = None
            elif not panel.country(iso3)["pov"].dropna().empty:
                poor = {"p5": 0.0, "p50": 0.0, "p95": 0.0}
            out["extra_poor_h5"][iso3] = (
                _row(
                    poor["p50"],
                    poor["p5"],
                    poor["p95"],
                    _band_conf(poor["p50"], poor["p5"], poor["p95"], eng_low),
                    as_of_s,
                    eng_inputs,
                )
                if poor
                else _row(None, None, None, "none", as_of_s, eng_inputs, note=poor_note)
            )

        # neighbor exposure: spill_i = sum_j w_ij x_j (neighbors' current fighting)
        if W is not None and iso3 in W.index and iso3 in panel.countries:
            w = W.loc[iso3]
            nb = x_now.reindex(w.index).fillna(0.0)
            spill = float((w * nb).sum())
            delta = sim.effect_draws(1, HORIZON, 0.0, N_SIMS, SEED)["spill_unit"]
            if delta is not None:
                e = (
                    np.expm1(delta[:, : HORIZON + 1] @ superposition_matrix(5, HORIZON, spill))[
                        :, HORIZON
                    ]
                    * 100
                )
                q = np.percentile(e, [5, 50, 95])
                top = (w * nb).sort_values(ascending=False).head(3)
                out["neighbor_exposure"][iso3] = _row(
                    q[1],
                    q[0],
                    q[2],
                    _band_conf(q[1], q[0], q[2], gdp_missing),
                    as_of_s,
                    {
                        **base_inputs,
                        "exposure_index": spill,
                        "main_sources": [i for i, v in top.items() if v > 0],
                    },
                )
            else:
                out["neighbor_exposure"][iso3] = _row(
                    None, None, None, "none", as_of_s, base_inputs
                )
        else:
            out["neighbor_exposure"][iso3] = _row(None, None, None, "none", as_of_s, base_inputs)

        status = (
            "unknown"
            if f is None or f["battle_fat_12m"] is None
            else "at_war"
            if iso3 in at_war
            else "low_level"
            if (f["pv_fat_12m"] or 0) > 0
            else "calm"
        )
        name = str(names.loc[iso3, "name"]) if names is not None and iso3 in names.index else iso3
        countries[iso3] = {
            "name": name,
            "population": pop,
            "status": status,
            "acled_coverage_start": base_inputs["acled_coverage_start"],
            "fatalities_36m": [] if f is None else _series_36m(f["monthly"], as_of),
        }

    return {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "as_of": as_of_s,
        "n_sims": N_SIMS,
        "seed": SEED,
        "horizon": HORIZON,
        "conversion": conv.to_dict(),
        "catalog": METRICS,
        "metrics": out,
        "countries": countries,
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    cfg = default_config()
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=cfg.artifacts_dir / "map_metrics.json")
    args = ap.parse_args()
    t0 = time.perf_counter()
    path, _ = resolve_indicators_path(cfg)
    long, _ = load_indicators(path)
    names = load_countries(cfg)
    acled = load_acled(cfg, names)
    if acled is None:
        raise SystemExit(
            "ACLED files not found in data/Conflict/ (they are local-only; see README)"
        )
    panel = build_panel(long, cfg, names)
    sim = Simulator(panel, Artifacts.load(cfg.artifacts_dir), cfg)
    conv = fit_conversion(acled, long)
    log.info(
        "ACLED -> UCDP factor %.3f (N=%d, %d countries, %.0f%% Africa)",
        conv.factor,
        conv.n_country_years,
        conv.n_countries,
        conv.africa_share * 100,
    )
    result = build_metrics(cfg, panel, sim, acled, conv, names)
    args.out.write_text(json.dumps(result, indent=1))
    log.info(
        "wrote %s (%d countries) in %.1fs",
        args.out,
        len(result["countries"]),
        time.perf_counter() - t0,
    )


if __name__ == "__main__":
    main()
