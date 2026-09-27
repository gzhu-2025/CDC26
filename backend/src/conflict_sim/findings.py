"""Findings page content, generated from artifacts (never hand-written).

    python -m conflict_sim.findings        # after estimation, lowo, metrics

Reads artifacts/ (estimation draws + meta), artifacts/map_metrics.json,
artifacts/lowo/{pooled,heterogeneity}.json, the ACLED cache and the data panel, and writes
artifacts/findings.json. Sentences come from conflict_sim.findings_text templates.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import numpy as np
import pandas as pd

from conflict_sim import findings_text as T
from conflict_sim.acled import load_acled
from conflict_sim.config import Config, default_config
from conflict_sim.io import load_countries, load_indicators, resolve_indicators_path
from conflict_sim.simulation.artifacts import Artifacts
from conflict_sim.simulation.simulator import own_effect, superposition_matrix
from conflict_sim.transforms import Panel, build_panel, intensity_to_x, sample_mask

log = logging.getLogger(__name__)
NEIGHBOR_KM = 500.0
ESCALATION_MIN_DEATHS = 25  # last 6 months; below this a change is noise, not a trend
SOURCES = [
    {
        "name": "ACLED",
        "detail": "Armed Conflict Location & Event Data, acleddata.com",
        "use": "recent political violence",
    },
    {
        "name": "UCDP",
        "detail": "battle-related deaths, via World Bank VC.BTL.DETH",
        "use": "historical war intensity",
    },
    {
        "name": "World Bank",
        "detail": "World Development Indicators",
        "use": "GDP, population, poverty, investment",
    },
    {"name": "Natural Earth", "detail": "1:50m admin-0 boundaries, public domain", "use": "map"},
]


def _date(iso: str | None) -> str | None:
    return None if not iso else iso[:10]


def _how(n_text: str, caveat: str, estimated_on: str) -> str:
    return f"{n_text} {caveat} Estimated on {estimated_on}."


def _q(a: np.ndarray, axis: int | None = 0) -> tuple[list[float], list[float], list[float]]:
    lo, mid, hi = np.percentile(a, [5, 50, 95], axis=axis)
    return mid.tolist(), lo.tolist(), hi.tolist()


def civil_war_intensity(cfg: Config, panel: Panel) -> tuple[float, str]:
    p = next(p for p in cfg.presets if p.key == "civil_war")
    d = panel.country(p.iso3).loc[p.start : p.end, "deaths_per_100k"].fillna(0)
    return float(d.mean()), p.like


# ---------- sections ----------
def section_world_now(
    acled: Any, mm: dict[str, Any], names: dict[str, str], est_on: str
) -> dict[str, Any]:
    w = acled.weekly.reset_index()
    w["month"] = w["week"].dt.to_period("M")
    as_of = acled.as_of
    last_full = (as_of.to_period("M") - 1) if as_of.day < 28 else as_of.to_period("M")
    months = pd.period_range(end=last_full, periods=36, freq="M")
    monthly = w.groupby("month")["pv_fat"].sum().reindex(months, fill_value=0.0)
    cutoff = as_of - pd.Timedelta(weeks=52)
    killed = float(w.loc[w["week"] > cutoff, "pv_fat"].sum())
    prev = float(
        w.loc[(w["week"] <= cutoff) & (w["week"] > cutoff - pd.Timedelta(weeks=52)), "pv_fat"].sum()
    )

    esc = mm["metrics"]["escalation_3m"]
    counts = {"escalating": [], "calming": [], "stable": []}
    for iso3, r in esc.items():
        inp = r.get("inputs", {})
        recent = (inp.get("fatalities_last_3m") or 0) + (inp.get("fatalities_prev_3m") or 0)
        if r["value"] is None or recent < ESCALATION_MIN_DEATHS:
            continue
        key = "escalating" if r["value"] > 0.15 else "calming" if r["value"] < -0.15 else "stable"
        counts[key].append(iso3)
    at_war = sum(1 for c in mm["countries"].values() if c["status"] == "at_war")
    sentences = T.world_now_sentences(
        killed, prev, len(counts["escalating"]), len(counts["calming"]), at_war
    )
    return {
        "id": "world_now",
        "heading": "The world right now",
        "sentences": sentences,
        "chart": {
            "type": "monthly_bars",
            "data": [{"month": str(m), "fatalities": float(v)} for m, v in monthly.items()],
            "unit": "political-violence deaths per month, worldwide",
        },
        "stats": {k: len(v) for k, v in counts.items()},
        "escalating": [{"iso3": i, "name": names.get(i, i)} for i in counts["escalating"]],
        "how_we_know": _how(
            f"ACLED records for {len(acled.countries)} countries and territories, as of {as_of.date()}.",
            f"Escalating or calming compares the last 3 months with the 3 before, only for countries "
            f"with at least {ESCALATION_MIN_DEATHS} deaths across those 6 months; the current month "
            f"is left out until it is complete.",
            est_on,
        ),
        "sr_summary": " ".join(sentences),
    }


def section_war_effect(
    art: Artifacts, x: float, like: str, est_on: str, n_countries: int
) -> dict[str, Any]:
    hz = [int(h) for h in art.horizons]
    eff = np.expm1(art.draws["gdp"]["continuous"] * x) * 100
    mid, lo, hi = _q(eff)
    leads_sig = any(
        p["outcome"] == "gdp" and p["measure"] == "continuous"
        for p in art.meta.get("pretrend_significant", [])
    )
    leads_band = any(T.band_excludes_zero(lo[i], hi[i]) for i, h in enumerate(hz) if h < 0)
    sentences = [
        T.effect_sentence(
            f"{label} after a year of fighting like {like}",
            "GDP per person",
            mid[hz.index(h)],
            lo[hz.index(h)],
            hi[hz.index(h)],
        )
        for h, label in ((1, "One year"), (5, "Five years"), (10, "Ten years"))
    ]
    sentences.append(T.pretrend_sentence(leads_sig or leads_band))
    return {
        "id": "war_effect",
        "heading": "What war does to an economy",
        "sentences": sentences,
        "chart": {
            "type": "effect_path",
            "horizons": hz,
            "mid": mid,
            "lo": lo,
            "hi": hi,
            "prewar": [hz[0], -1],
            "unit": "% GDP per person vs no war",
        },
        "horizon_checks": [
            {"h": h, "band_excludes_zero": T.band_excludes_zero(lo[i], hi[i])}
            for i, h in enumerate(hz)
        ],
        "how_we_know": _how(
            f"Local projections on {n_countries} countries, 1990-2023, {len(art.draws['gdp']['continuous'])} "
            f"country-resampled draws; the band is the 90% range.",
            "Associational: it shows what usually comes with war, not proof of cause.",
            est_on,
        ),
        "sr_summary": " ".join(sentences),
    }


def section_longer_wars(
    art: Artifacts, cfg: Config, intensity: float, est_on: str
) -> dict[str, Any]:
    t = art.response_terms("gdp", "continuous", 10)
    items = []
    for d in (1, 3, 5, 10):
        eff = (
            np.expm1(
                own_effect(
                    t["shock"],
                    t.get("shock_age"),
                    d,
                    10,
                    intensity,
                    scale=cfg.conflict.intensity_scale,
                )[:, 10]
            )
            * 100
        )
        m, lo, hi = np.percentile(eff, [50, 5, 95])
        items.append({"duration": d, "mid": float(m), "lo": float(lo), "hi": float(hi)})
    # per draw: |marginal cost of the 10th war year| - |cost of the first year|
    x1 = own_effect(
        t["shock"], t.get("shock_age"), 1, 10, intensity, scale=cfg.conflict.intensity_scale
    )[:, 10]
    x9 = own_effect(
        t["shock"], t.get("shock_age"), 9, 10, intensity, scale=cfg.conflict.intensity_scale
    )[:, 10]
    x10 = own_effect(
        t["shock"], t.get("shock_age"), 10, 10, intensity, scale=cfg.conflict.intensity_scale
    )[:, 10]
    diff = (np.abs(x10 - x9) - np.abs(x1)) * 100
    later = tuple(float(v) for v in np.percentile(diff, [50, 5, 95]))
    sentences = T.longer_wars_sentences(items, later)
    return {
        "id": "longer_wars",
        "heading": "Longer wars",
        "sentences": sentences,
        "chart": {
            "type": "duration_bars",
            "items": items,
            "unit": "% GDP per person after 10 years",
        },
        "how_we_know": _how(
            "Adds up each war year's effect, with a term letting later years of a war hurt less.",
            "The long-war term is estimated from wars of very different lengths; it is imprecise.",
            est_on,
        ),
        "sr_summary": " ".join(sentences),
    }


def section_borders(
    art: Artifacts, cfg: Config, x: float, mm: dict[str, Any], names: dict[str, str], est_on: str
) -> dict[str, Any]:
    t = art.response_terms("gdp", "continuous", 10)
    w = float(np.exp(-NEIGHBOR_KM / cfg.spatial.kernel_km))
    if "spill" in t:
        e = np.expm1(w * (t["spill"] @ superposition_matrix(1, 10, x))[:, 10]) * 100
        m, lo, hi = (float(v) for v in np.percentile(e, [50, 5, 95]))
    else:
        m = lo = hi = 0.0
    rows = [(i, r) for i, r in mm["metrics"]["neighbor_exposure"].items() if r["value"] is not None]
    rows.sort(key=lambda ir: ir[1]["value"])
    top = [
        {
            "iso3": i,
            "name": names.get(i, i),
            "mid": r["value"],
            "lo": r["lo"],
            "hi": r["hi"],
            "sources": [names.get(s, s) for s in r.get("inputs", {}).get("main_sources", [])],
        }
        for i, r in rows[:10]
    ]
    sentences = T.borders_sentences(m, lo, hi, NEIGHBOR_KM, top[0]["name"] if top else None)
    return {
        "id": "borders",
        "heading": "It crosses borders",
        "sentences": sentences,
        "number": {"mid": m, "lo": lo, "hi": hi, "unit": "% GDP per person after 10 years"},
        "chart": {
            "type": "ranked_list",
            "items": top,
            "unit": "% GDP per person after 5 years if current fighting continues",
        },
        "how_we_know": _how(
            f"Neighbor effects weight fighting by distance between capitals (falls off over ~{cfg.spatial.kernel_km:.0f} km).",
            "Capital-to-capital distance is a rough proxy for where fighting actually happens.",
            est_on,
        ),
        "sr_summary": " ".join(sentences),
    }


def section_poverty(mm: dict[str, Any], names: dict[str, str], est_on: str) -> dict[str, Any]:
    rows = [(i, r) for i, r in mm["metrics"]["extra_poor_h5"].items() if r["value"] is not None]
    active = [(i, r) for i, r in rows if r["value"] != 0 or r["hi"] != 0]
    tot = {k: float(sum(r[k] for _, r in active)) for k in ("value", "lo", "hi")}
    active.sort(key=lambda ir: -ir[1]["value"])
    top = [
        {"iso3": i, "name": names.get(i, i), "mid": r["value"], "lo": r["lo"], "hi": r["hi"]}
        for i, r in active[:8]
    ]
    sentences = T.poverty_sentences(
        tot["value"], tot["lo"], tot["hi"], len(active), top[0]["name"] if top else None
    )
    stale = sum(
        1
        for _, r in mm["metrics"]["extra_poor_h5"].items()
        if (r.get("note") or "").startswith("poverty survey too old")
    )
    return {
        "id": "poverty",
        "heading": "Who falls into poverty",
        "sentences": sentences,
        "number": {
            "mid": tot["value"],
            "lo": max(0.0, tot["lo"]),
            "hi": tot["hi"],
            "unit": "people",
        },
        "chart": {
            "type": "ranked_list",
            "items": top,
            "unit": "extra people below $2.15/day after 5 years",
        },
        "how_we_know": _how(
            f"Poverty follows GDP with an assumed elasticity; {len(active)} countries with conflict and a poverty survey.",
            f"The world total adds country ranges end to end (they share the same model draws). "
            f"{stale} countries are left out because their last survey is over 10 years old.",
            est_on,
        ),
        "sr_summary": " ".join(sentences),
    }


def section_heterogeneity(het: dict[str, Any] | None, est_on: str) -> dict[str, Any]:
    sentences = T.heterogeneity_sentences(het)
    return {
        "id": "heterogeneity",
        "heading": "Does it differ by country?",
        "sentences": sentences,
        "chart": None
        if het is None
        else {
            "type": "candidate_table",
            "candidates": het["candidates"],
            "rule": "A model passes only if it beats the simple model on at least 20 of 29 held-out "
            "wars and its 90% ranges are closer to 90% coverage.",
        },
        "how_we_know": _how(
            "Two models were pre-registered (backend/PREREGISTRATION.md) and scored on held-out wars.",
            "A model had to be better on at least 20 of 29 wars and give better-calibrated ranges.",
            est_on if het is None else _date(het["created_at"]),
        ),
        "sr_summary": " ".join(sentences),
    }


def section_backtest(
    lowo: dict[str, Any] | None, names: dict[str, str], est_on: str
) -> dict[str, Any]:
    if lowo is None:
        s = ["The out-of-sample test has not been run yet."]
        return {
            "id": "backtest",
            "heading": "How well does the model do?",
            "sentences": s,
            "chart": None,
            "how_we_know": _how("", "", est_on),
            "sr_summary": s[0],
        }
    sm = lowo["summary"]
    wars = sorted(lowo["wars"], key=lambda w: abs(w["log_err"]))
    n = len(wars)
    pick = wars[:2] + wars[n // 2 - 1 : n // 2 + 1] + wars[-2:]
    tags = ["best", "best", "typical", "typical", "worst", "worst"]
    multiples = [
        {
            "iso3": w["iso3"],
            "name": names.get(w["iso3"], w["iso3"]),
            "start": w["start"],
            "duration": w["duration"],
            "tag": tag,
            "years": w["years"],
            "actual": w["actual_path"],
            "war_mid": w["war_p50"],
            "war_lo": w["war_p5"],
            "war_hi": w["war_p95"],
            "nowar": w["nowar_p50"],
            "inside": w["in_90"],
            "off_pct": (w["actual"] / w["war_end"] - 1) * 100,
        }
        for w, tag in zip(pick, tags, strict=True)
    ]
    sentences = T.backtest_sentences(
        n, sm["coverage_90"], sm["wins_vs_no_war"], sm["band_calibration_k"]
    )
    return {
        "id": "backtest",
        "heading": "How well does the model do?",
        "sentences": sentences,
        "chart": {"type": "small_multiples", "wars": multiples},
        "scorecard": {
            "n_wars": n,
            "coverage_90": sm["coverage_90"],
            "wins_vs_no_war": sm["wins_vs_no_war"],
            "band_calibration_k": sm["band_calibration_k"],
        },
        "how_we_know": _how(
            f"Each of {n} wars was predicted by a model estimated without that country ({lowo['n_draws']} draws).",
            "Ranges shown elsewhere on the site are not yet widened by the calibration factor.",
            _date(lowo["created_at"]),
        ),
        "sr_summary": " ".join(sentences),
    }


def missing_tiers(panel: Panel, cfg: Config) -> dict[str, float]:
    df = panel.df[sample_mask(panel, cfg)]
    dp = df["deaths_per_100k"]
    war = df["conflict"] == 1
    p90 = dp[war].quantile(0.9)
    tiers = {
        "peace": df[~war.fillna(False) & dp.notna()],
        "minor": df[war & (dp < p90)],
        "intense": df[war & (dp >= p90)],
    }
    out = {f"gdp_{k}": float(v["gdp"].isna().mean() * 100) for k, v in tiers.items()}
    out.update({f"pov_{k}": float(v["pov"].isna().mean() * 100) for k, v in tiers.items()})
    out["intense_threshold_per_100k"] = float(p90)
    out.update({f"n_{k}": len(v) for k, v in tiers.items()})
    return out


def section_limits(
    panel: Panel, cfg: Config, art: Artifacts, mm: dict[str, Any], acled: Any, est_on: str
) -> dict[str, Any]:
    tiers = missing_tiers(panel, cfg)
    fdi_rows = [r for r in art.estimates["fdi"]["continuous"] if r["h"] >= 0]
    n_sig = sum(1 for r in fdi_rows if r["p_value"] < 0.05)
    conv = mm["conversion"]
    cov = acled.coverage_start.dt.year.value_counts().sort_index()
    sentences = [
        "These are associations, not proof of cause: countries that go to war differ in many ways, "
        "and economic collapse can itself lead to war.",
        T.missing_data_sentence(
            tiers["gdp_peace"], tiers["gdp_minor"], tiers["gdp_intense"], tiers["pov_intense"]
        ),
        T.fdi_sentence(n_sig, len(fdi_rows)),
        f"ACLED's records start in different years by region (from {int(cov.index.min())} for the "
        f"earliest to {int(cov.index.max())} for the most recently added places), so recent trends are "
        f"more reliable than long histories.",
        T.conversion_sentence(
            conv["factor"],
            conv["factor_iqr"][0],
            conv["factor_iqr"][1],
            conv["n_country_years"],
            conv["africa_share"],
        ),
    ]
    return {
        "id": "limits",
        "heading": "Methods and limits",
        "sentences": sentences,
        "chart": {
            "type": "missing_by_tier",
            "tiers": [
                {
                    "tier": "Peace",
                    "gdp_missing": tiers["gdp_peace"],
                    "poverty_missing": tiers["pov_peace"],
                    "n": tiers["n_peace"],
                },
                {
                    "tier": "Conflict",
                    "gdp_missing": tiers["gdp_minor"],
                    "poverty_missing": tiers["pov_minor"],
                    "n": tiers["n_minor"],
                },
                {
                    "tier": "Most intense 10%",
                    "gdp_missing": tiers["gdp_intense"],
                    "poverty_missing": tiers["pov_intense"],
                    "n": tiers["n_intense"],
                },
            ],
            "unit": "% of country-years with no data",
        },
        "acled_coverage": [{"year": int(y), "countries": int(n)} for y, n in cov.items()],
        "how_we_know": _how(
            f"Missing-data shares use {tiers['n_peace'] + tiers['n_minor'] + tiers['n_intense']:,} country-years, 1990-2023; "
            f"'most intense' means at least {tiers['intense_threshold_per_100k']:.0f} battle deaths per 100k.",
            "",
            est_on,
        ),
        "sr_summary": " ".join(sentences),
    }


def section_about(n_countries: int, years: list[int], est_on: str) -> dict[str, Any]:
    sentences = [
        "This site estimates how armed conflict changes a country's economy, and shows where "
        "conflict is happening now.",
        f"It learns from what happened to income per person in {n_countries} countries between "
        f"{years[0]} and {years[1]}, then applies those patterns to today's fighting.",
        "Method in one line: compare each country's path after conflict with its own pre-war trend, "
        "across many wars at once.",
    ]
    return {
        "id": "about",
        "heading": "About this site",
        "sentences": sentences,
        "chart": None,
        "how_we_know": _how("", "", est_on),
        "sr_summary": " ".join(sentences),
    }


def build(cfg: Config) -> dict[str, Any]:
    art = Artifacts.load(cfg.artifacts_dir)
    mm = json.loads((cfg.artifacts_dir / "map_metrics.json").read_text())
    lowo_dir = cfg.artifacts_dir / "lowo"
    lowo = (
        json.loads((lowo_dir / "pooled.json").read_text())
        if (lowo_dir / "pooled.json").exists()
        else None
    )
    het = (
        json.loads((lowo_dir / "heterogeneity.json").read_text())
        if (lowo_dir / "heterogeneity.json").exists()
        else None
    )
    path, _ = resolve_indicators_path(cfg)
    long, _ = load_indicators(path)
    meta = load_countries(cfg)
    panel = build_panel(long, cfg, meta)
    acled = load_acled(cfg, meta)
    if acled is None:
        raise SystemExit("ACLED files not found in data/Conflict/ (local-only; see README)")
    names = {i: c["name"] for i, c in mm["countries"].items()}
    est_on = _date(art.meta["created_at"])
    intensity, like = civil_war_intensity(cfg, panel)
    x = float(intensity_to_x(intensity, cfg.conflict.intensity_scale))
    world = section_world_now(acled, mm, names, est_on)
    sections = [
        world,
        section_war_effect(art, x, like, est_on, art.meta.get("n_countries", 0)),
        section_longer_wars(art, cfg, intensity, est_on),
        section_borders(art, cfg, x, mm, names, est_on),
        section_poverty(mm, names, est_on),
        section_heterogeneity(het, est_on),
        section_backtest(lowo, names, est_on),
        section_about(art.meta.get("n_countries", 0), art.meta.get("years", [1990, 2023]), est_on),
        section_limits(panel, cfg, art, mm, acled, est_on),
    ]
    w = acled.weekly.reset_index()
    killed_12m = float(w.loc[w["week"] > acled.as_of - pd.Timedelta(weeks=52), "pv_fat"].sum())
    return {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "estimated_on": est_on,
        "acled_as_of": str(acled.as_of.date()),
        "lowo_on": None if lowo is None else _date(lowo["created_at"]),
        "hero": [
            {
                "id": "killed_12m",
                "value": killed_12m,
                "display": T.people(killed_12m),
                "text": "people killed in political violence in the last 12 months",
                "as_of": str(acled.as_of.date()),
            },
            {
                "id": "escalating",
                "value": world["stats"]["escalating"],
                "display": str(world["stats"]["escalating"]),
                "text": "countries escalating in the last 3 months",
                "as_of": str(acled.as_of.date()),
            },
            {
                "id": "at_war",
                "value": sum(1 for c in mm["countries"].values() if c["status"] == "at_war"),
                "display": str(sum(1 for c in mm["countries"].values() if c["status"] == "at_war")),
                "text": "countries at war by our definition",
                "as_of": str(acled.as_of.date()),
            },
        ],
        "sections": sections,
        "sources": SOURCES,
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    cfg = default_config()
    out = build(cfg)
    path = cfg.artifacts_dir / "findings.json"
    path.write_text(json.dumps(out, indent=1))
    log.info("wrote %s (%d sections)", path, len(out["sections"]))


if __name__ == "__main__":
    main()
