"""Inspection report: a single HTML page for judging the model by eye.

    python -m conflict_sim.report [--draws 200] [--out reports/inspect.html]

Sections: (1) synthetic check against known answers, (2) war effect curves incl. the
years before a war, (3) every backtested war, (4) scorecard vs. "predict no war",
(5) three worked examples, (6) how to run things locally. Captions are computed from
the numbers, not hard-coded.
"""

from __future__ import annotations

import argparse
import logging
import tempfile
from dataclasses import dataclass
from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from conflict_sim.backtest import select_episodes
from conflict_sim.config import BACKEND_DIR, Config, default_config
from conflict_sim.estimation.__main__ import run as run_estimation
from conflict_sim.fixtures import TRUE_GDP_BETA, TRUE_GDP_DELTA, TRUE_GDP_GAMMA
from conflict_sim.io import load_country_meta, load_indicators, resolve_indicators_path
from conflict_sim.report_svg import Band, Chart, HBar, Line, hbar_chart, legend
from conflict_sim.simulation.artifacts import Artifacts
from conflict_sim.simulation.simulator import Simulator, own_effect, superposition_matrix
from conflict_sim.transforms import Panel, build_panel

log = logging.getLogger(__name__)

INK, BLUE, ORANGE, GRAY = "var(--ink)", "var(--s1)", "var(--s2)", "var(--muted)"
YEARS_AFTER = list(range(0, 11))
NEIGHBOR_KM = 500.0


@dataclass
class Ctx:
    cfg: Config
    panel: Panel
    artifacts: Artifacts
    sim: Simulator
    names: pd.DataFrame | None
    label: str

    def name(self, iso3: str) -> str:
        if self.names is not None and iso3 in self.names.index:
            return str(self.names.loc[iso3, "name"])
        return iso3


def load_ctx(cfg: Config, source: str | None, artifacts_dir: Path) -> Ctx:
    path, label = resolve_indicators_path(cfg, source)
    long, _ = load_indicators(path)
    names = load_country_meta(cfg, path, label)
    panel = build_panel(long, cfg, names)
    art = Artifacts.load(artifacts_dir)
    return Ctx(cfg, panel, art, Simulator(panel, art, cfg), names, label)


# ---------- formatting ----------
def pct(v: float, signed: bool = True) -> str:
    return f"{v:+.0f}%" if signed else f"{abs(v):.0f}%"


def pct1(v: float) -> str:
    return f"{v:+.1f}%"


def usd(v: float) -> str:
    return f"${v:,.0f}"


def to_pct(log_effect: np.ndarray) -> np.ndarray:
    return np.expm1(log_effect) * 100.0


def q(a: np.ndarray, p: float) -> list[float]:
    return np.percentile(a, p, axis=0).tolist()


def x_of(intensity: float, cfg: Config) -> float:
    return float(np.log1p(intensity / cfg.conflict.intensity_scale))


def preset(ctx: Ctx, key: str) -> dict[str, Any]:
    p = next(p for p in ctx.cfg.presets if p.key == key)
    d = ctx.panel.country(p.iso3).loc[p.start : p.end, "deaths_per_100k"].fillna(0)
    return {**p.model_dump(), "duration": p.end - p.start + 1, "intensity": float(d.mean())}


def caption(text: str) -> str:
    return f'<p class="caption">{text}</p>'


def figure(title: str, chart_svg: str, cap: str, legend_html: str = "") -> str:
    return (
        f'<figure><figcaption class="fig-title">{escape(title)}</figcaption>'
        f"{legend_html}{chart_svg}{caption(cap)}</figure>"
    )


# ---------- 1. synthetic check ----------
def section_synthetic(syn: Ctx) -> tuple[str, dict[str, Any]]:
    cfg = syn.cfg
    intensity, duration = 50.0, 5
    t = syn.artifacts.response_terms("gdp", "continuous", 10)
    est = to_pct(
        own_effect(
            t["shock"],
            t.get("shock_age"),
            duration,
            10,
            intensity,
            scale=cfg.conflict.intensity_scale,
        )
    )
    true = to_pct(
        own_effect(
            TRUE_GDP_BETA[None],
            TRUE_GDP_GAMMA[None],
            duration,
            10,
            intensity,
            scale=cfg.conflict.intensity_scale,
        )
    )[0]
    lo, hi, med = q(est, 5), q(est, 95), q(est, 50)
    inside = sum(a <= v <= b for v, a, b in zip(true, lo, hi, strict=True))

    w = float(np.exp(-NEIGHBOR_KM / cfg.spatial.kernel_km))
    C = superposition_matrix(duration, 10, x_of(intensity, cfg))
    nb_est = to_pct(w * (t["spill"] @ C)) if "spill" in t else None
    nb_true = to_pct(w * (TRUE_GDP_DELTA[None] @ C))[0]

    def chart(true_v, med_v, lo_v, hi_v, aria):  # type: ignore[no-untyped-def]
        return Chart(
            x=YEARS_AFTER,
            lines=[Line(true_v, INK, "True answer", 2.5), Line(med_v, ORANGE, "Model estimate")],
            bands=[Band(lo_v, hi_v, ORANGE)],
            shade=(0, duration - 1),
            shade_label="War",
            yfmt=pct,
            zero_line=True,
            xlabel_every=2,
            aria=aria,
        ).svg()

    lg = legend(
        [
            ("True answer (we built it into the fake data)", INK, "line"),
            ("Model estimate", ORANGE, "line"),
            ("Model's 90% range", ORANGE, "band"),
        ]
    )
    verdict = (
        "it recovered the truth"
        if inside >= 10
        else "it mostly recovered the truth"
        if inside >= 8
        else "it did <b>not</b> reliably recover the truth"
    )
    html = figure(
        "A 5-year war in a made-up country (known answer)",
        chart(true, med, lo, hi, "synthetic own effect"),
        f"We made up 40 countries with wars whose damage we chose ourselves, then asked the model "
        f"to find it. The black line is the damage we built in; orange is what the model found. "
        f"The true answer stays inside the model's range in <b>{inside} of 11 years</b>, so "
        f"{verdict}. Year 10: true {pct(true[-1])}, estimated {pct(med[-1])}. "
        f"<b>But note how wide the range is</b> ({pct(lo[-1])} to {pct(hi[-1])} by year 10): "
        f"40 made-up countries is not much data, and a wide range is easy to land in. "
        f"This shows the method is not biased, not that it is precise.",
        lg,
    )
    nb_inside = None
    if nb_est is not None:
        nlo, nhi, nmed = q(nb_est, 5), q(nb_est, 95), q(nb_est, 50)
        nb_inside = sum(a <= v <= b for v, a, b in zip(nb_true, nlo, nhi, strict=True))
        html += figure(
            f"The same war's effect on a neighbor {NEIGHBOR_KM:.0f} km away (known answer)",
            chart(nb_true, nmed, nlo, nhi, "synthetic neighbor effect"),
            f"Countries next to a war lose income too. The true answer stays inside the range in "
            f"<b>{nb_inside} of 11 years</b>. Year 10: true {pct1(nb_true[-1])}, "
            f"estimated {pct1(nmed[-1])}.",
            lg,
        )
    return html, {"inside": inside, "nb_inside": nb_inside}


# ---------- 2. war effect curves ----------
def section_curves(ctx: Ctx) -> tuple[str, dict[str, Any]]:
    cfg, art = ctx.cfg, ctx.artifacts
    cw = preset(ctx, "civil_war")
    x = x_of(cw["intensity"], cfg)
    hz = [int(h) for h in art.horizons]
    one_year = to_pct(art.draws["gdp"]["continuous"] * x)
    lo, hi, med = q(one_year, 5), q(one_year, 95), q(one_year, 50)
    leads = [(h, med[i], lo[i] <= 0 <= hi[i]) for i, h in enumerate(hz) if h < 0]
    clean = all(ok for _, _, ok in leads)
    lead_txt = ", ".join(f"{pct1(v)} ({-h} yr before)" for h, v, _ in leads)
    lg = legend([("Typical effect", ORANGE, "line"), ("90% range", ORANGE, "band")])

    html = figure(
        f"One year of fighting at civil-war level (like {cw['like']}, "
        f"{cw['intensity']:.0f} deaths per 100k people)",
        Chart(
            x=hz,
            lines=[Line(med, ORANGE, "Typical effect")],
            bands=[Band(lo, hi, ORANGE)],
            before_zone=(-3, -1),
            vline=-0.5,
            yfmt=pct,
            zero_line=True,
            xlabel_every=1,
            aria="one-year effect with pre-war years",
        ).svg(),
        f"Income per person compared with no fighting, from 3 years <b>before</b> to 10 years "
        f"after. The gray zone on the left is a honesty check: a war can't cause anything before "
        f"it starts, so those points should sit near zero. Here they are {lead_txt}. "
        + (
            "Zero is inside the range for all three, so <b>the check passes</b>: countries were "
            "not already sliding before their wars."
            if clean
            else "<b>The check fails</b> for at least one year: countries were already changing before "
            "the war, so part of what we call war damage may have started earlier."
        )
        + f" One year of fighting leaves income about {pct(med[-1])} after 10 years.",
        lg,
    )

    t = art.response_terms("gdp", "continuous", 10)
    five = to_pct(
        own_effect(
            t["shock"],
            t.get("shock_age"),
            5,
            10,
            cw["intensity"],
            scale=cfg.conflict.intensity_scale,
        )
    )
    flo, fhi, fmed = q(five, 5), q(five, 95), q(five, 50)
    harm = float((five[:, -1] < 0).mean() * 100)
    html += figure(
        "A 5-year civil war, all years added up",
        Chart(
            x=YEARS_AFTER,
            lines=[Line(fmed, ORANGE, "Typical effect")],
            bands=[Band(flo, fhi, ORANGE)],
            shade=(0, 4),
            shade_label="War",
            yfmt=pct,
            zero_line=True,
            xlabel_every=2,
            aria="five-year war effect",
        ).svg(),
        f"The damage builds while the war lasts and mostly stays afterwards. After 10 years "
        f"income per person is typically {pct(fmed[-1])} (90% range {pct(flo[-1])} to "
        f"{pct(fhi[-1])}). In {harm:.0f}% of our simulations the war leaves people poorer.",
        lg,
    )

    if "continuous_spill" in art.draws["gdp"]:
        w = float(np.exp(-NEIGHBOR_KM / cfg.spatial.kernel_km))
        nb = to_pct(art.draws["gdp"]["continuous_spill"] * x * w)
        nlo, nhi, nmed = q(nb, 5), q(nb, 95), q(nb, 50)
        nleads_ok = all(nlo[i] <= 0 <= nhi[i] for i, h in enumerate(hz) if h < 0)
        html += figure(
            f"Effect on a neighbor {NEIGHBOR_KM:.0f} km away (one year of civil-war fighting next door)",
            Chart(
                x=hz,
                lines=[Line(nmed, ORANGE, "Typical effect")],
                bands=[Band(nlo, nhi, ORANGE)],
                before_zone=(-3, -1),
                vline=-0.5,
                yfmt=pct1,
                zero_line=True,
                xlabel_every=1,
                aria="neighbor effect",
            ).svg(),
            f"Neighbors are hit more slowly: {pct1(nmed[hz.index(5)])} after 5 years, "
            f"{pct1(nmed[-1])} after 10. The before-war check "
            + ("passes." if nleads_ok else "<b>fails</b> for at least one year.")
            + " The range is wide, so treat neighbor numbers as a rough direction, not a precise size.",
            lg,
        )
    return html, {"leads_clean": clean}


# ---------- 3 + 4. backtest ----------
def backtest_rows(ctx: Ctx) -> list[dict[str, Any]]:
    rows = []
    for e in select_episodes(ctx.panel, ctx.cfg).itertuples():
        try:
            res, _ = ctx.sim.simulate(
                e.iso3,
                int(e.start),
                int(min(e.duration, 20)),
                float(e.intensity),
                horizon=int(e.horizon),
                n_sims=4000,
                seed=0,
            )
        except (ValueError, KeyError):
            continue
        g = res["gdp_pc"]
        if g["actual"][-1] is None:
            continue
        years = list(range(int(e.start) - 5, int(e.start) + int(e.horizon) + 1))
        hist = ctx.panel.country(e.iso3)["gdp"].reindex(years)
        sim_idx = {y: i for i, y in enumerate(res["years"])}

        def on_years(vals: list[float]) -> list[float | None]:
            return [vals[sim_idx[y]] if y in sim_idx else None for y in years]  # noqa: B023

        actual = float(g["actual"][-1])
        war, nowar = g["scenario"]["p50"][-1], g["baseline"]["p50"][-1]
        rows.append(
            {
                "iso3": e.iso3,
                "name": ctx.name(e.iso3),
                "start": int(e.start),
                "duration": int(e.duration),
                "intensity": float(e.intensity),
                "horizon": int(e.horizon),
                "years": years,
                "actual_path": [None if np.isnan(v) else float(v) for v in hist],
                "nowar": on_years(g["baseline"]["p50"]),
                "war": on_years(g["scenario"]["p50"]),
                "lo": on_years(g["scenario"]["p5"]),
                "hi": on_years(g["scenario"]["p95"]),
                "inside": g["scenario"]["p5"][-1] <= actual <= g["scenario"]["p95"][-1],
                "off_pct": (actual / war - 1) * 100,
                "err_war": abs(actual / war - 1) * 100,
                "err_nowar": abs(actual / nowar - 1) * 100,
            }
        )
    return rows


def section_backtest(rows: list[dict[str, Any]]) -> str:
    rows = sorted(rows, key=lambda r: -r["err_war"])
    n_in = sum(r["inside"] for r in rows)
    cards = []
    for r in rows:
        c = Chart(
            x=r["years"],
            lines=[
                Line(r["actual_path"], INK, "What happened", 2.5, span_gaps=True),
                Line(r["nowar"], BLUE, "Predicted without war"),
                Line(r["war"], ORANGE, "Predicted with war"),
            ],
            bands=[Band(r["lo"], r["hi"], ORANGE)],
            shade=(r["start"], min(r["start"] + r["duration"] - 1, r["years"][-1])),
            yfmt=lambda v: f"${v / 1000:.1f}k" if v >= 1000 else f"${v:.0f}",
            width=320,
            height=170,
            xlabel_every=5,
            aria=f"{r['name']} {r['start']}",
            badge="OUTSIDE RANGE" if not r["inside"] else "inside range",
            badge_class="bad" if not r["inside"] else "ok",
        ).svg()
        direction = "better" if r["off_pct"] > 0 else "worse"
        cards.append(
            f'<div class="card {"out" if not r["inside"] else ""}">'
            f'<div class="card-title">{escape(r["name"])} {r["start"]}</div>'
            f'<div class="card-sub">{r["duration"]}-year war · {r["intensity"]:.0f} deaths per 100k/yr'
            f" · reality was {abs(r['off_pct']):.0f}% {direction} than predicted</div>{c}</div>"
        )
    lg = legend(
        [
            ("What happened", INK, "line"),
            ("Predicted without war", BLUE, "line"),
            ("Predicted with war", ORANGE, "line"),
            ("90% range", ORANGE, "band"),
        ]
    )
    return (
        lg
        + f'<div class="cards">{"".join(cards)}</div>'
        + caption(
            f"Each box replays one real war: we started the model the year the war began using only "
            f"earlier data, then compared with what really happened (black). Sorted from the worst "
            f"miss to the best. <b>{n_in} of {len(rows)}</b> real outcomes landed inside the 90% "
            f"range; a well-calibrated model would get about {round(0.9 * len(rows))}. "
            f"Red boxes are the misses."
        )
    )


def section_scorecard(rows: list[dict[str, Any]]) -> tuple[str, dict[str, Any]]:
    bars = sorted(
        (
            HBar(
                f"{r['name']} {r['start']}",
                r["err_nowar"] - r["err_war"],
                note=f" (our miss {r['err_war']:.0f}%, 'no war' miss {r['err_nowar']:.0f}%)",
            )
            for r in rows
        ),
        key=lambda b: -b.value,
    )
    wins = sum(b.value > 0 for b in bars)
    gains = [b.value for b in bars]
    top3 = sum(sorted((g for g in gains if g > 0), reverse=True)[:3])
    total = sum(g for g in gains if g > 0) or 1
    html = hbar_chart(bars, lambda v: f"{v:+.0f} pts") + caption(
        f"For each war: how much closer our prediction was than simply assuming the war changed "
        f"nothing (percentage points of income). Blue bars to the right mean we did better; red "
        f"bars to the left mean assuming 'no war' would have been closer. We win on "
        f"<b>{wins} of {len(bars)}</b> wars. The three biggest wins make up "
        f"{top3 / total * 100:.0f}% of all the gains, so "
        + (
            "the advantage is broad."
            if top3 / total < 0.5
            else "<b>most of our advantage comes from a few wars</b>, not a broad edge."
        )
    )
    return html, {"wins": wins, "n": len(bars)}


# ---------- 5. worked examples ----------
def section_examples(ctx: Ctx) -> str:
    out = []
    for key in ("catastrophe", "major_war", "insurgency"):
        iso = next((q.iso3 for q in ctx.cfg.presets if q.key == key), None)
        if iso not in ctx.panel.countries:
            continue  # preset country not in this dataset (e.g. the synthetic fixture)
        p = preset(ctx, key)
        iso3, onset, dur = p["iso3"], p["start"], min(10, p["duration"])
        res, warns = ctx.sim.simulate(
            iso3, onset, dur, p["intensity"], horizon=10, n_sims=10000, seed=1
        )
        name = ctx.name(iso3)
        ba, g, years = res["baseline_assumptions"], res["gdp_pc"], res["years"]
        hist = ctx.panel.country(iso3)
        pre = hist.loc[: onset - 1, "dlngdp"].dropna().tail(10) * 100
        anchor = float(hist.loc[ba["anchor_year"], "gdp"])
        gap = g["gap"]["p50"]
        last = years[-1]
        actual_end = next(
            (
                (y, v)
                for y, v in zip(reversed(years), reversed(g["actual"]), strict=True)
                if v is not None
            ),
            None,
        )
        prior_war = [w for w in warns if w.code == "CURRENTLY_AT_WAR"]
        chart_years = list(range(onset - 8, last + 1))
        hmap = hist["gdp"].reindex(chart_years)
        idx = {y: i for i, y in enumerate(years)}

        def on(vals: list[float]) -> list[float | None]:
            return [vals[idx[y]] if y in idx else None for y in chart_years]  # noqa: B023

        chart = Chart(
            x=chart_years,
            lines=[
                Line(
                    [None if np.isnan(v) else float(v) for v in hmap],
                    INK,
                    "What happened",
                    2.5,
                    span_gaps=True,
                ),
                Line(on(g["baseline"]["p50"]), BLUE, "Predicted without war"),
                Line(on(g["scenario"]["p50"]), ORANGE, "Predicted with war"),
            ],
            bands=[Band(on(g["scenario"]["p5"]), on(g["scenario"]["p95"]), ORANGE)],
            shade=(onset, onset + dur - 1),
            shade_label="War",
            yfmt=usd,
            width=640,
            height=240,
            aria=f"worked example {name}",
        ).svg()
        steps = [
            f"<b>What went in.</b> {escape(name)}'s income per person was {usd(anchor)} in "
            f"{ba['anchor_year']}. Over the 10 years before, it grew {pre.mean():+.1f}% a year on "
            f"average, swinging between {pre.min():+.1f}% and {pre.max():+.1f}%. The war: "
            f"{p['intensity']:.0f} battle deaths per 100,000 people a year for {dur} years "
            f"({escape(p['like'])}, {onset}–{onset + dur - 1}).",
            f"<b>The no-war forecast.</b> A time-series model fitted to {escape(name)}'s own history "
            f"({escape(ba['method'])}) expects about {ba['gdp_growth_pct']:+.1f}% growth a year, "
            f"reaching {usd(g['baseline']['p50'][-1])} by {last} "
            f"(90% range {usd(g['baseline']['p5'][-1])}–{usd(g['baseline']['p95'][-1])}).",
            f"<b>What the war adds.</b> In past wars this intense, income per person ended up "
            f"{pct(gap[1])} after 1 year, {pct(gap[5])} after 5 years and {pct(gap[-1])} after 10, "
            f"compared with no war.",
            f"<b>Final answer.</b> With the war: about {usd(g['scenario']['p50'][-1])} by {last} "
            f"(90% range {usd(g['scenario']['p5'][-1])}–{usd(g['scenario']['p95'][-1])}), "
            f"i.e. {pct(-gap[-1], signed=False)} {'poorer' if gap[-1] < 0 else 'richer'} than without it.",
        ]
        if actual_end:
            y, v = actual_end
            steps.append(
                f"<b>What really happened.</b> By {y}, income per person was {usd(v)}: "
                f"{pct((v / g['scenario']['p50'][years.index(y)] - 1) * 100)} vs. our with-war "
                f"prediction and {pct((v / g['baseline']['p50'][years.index(y)] - 1) * 100)} vs. "
                f"the no-war forecast."
            )
        if prior_war:
            steps.append(
                f"<i>Note: {escape(name)} was already in conflict the year before, so this is "
                f"modeled as a new war on top of that.</i>"
            )
        out.append(
            f'<div class="example"><h3>{escape(name)}: {escape(p["label"].lower())}, {onset}</h3>'
            f"<ol>{''.join(f'<li>{s}</li>' for s in steps)}</ol>"
            + legend(
                [
                    ("What happened", INK, "line"),
                    ("Predicted without war", BLUE, "line"),
                    ("Predicted with war (range shaded)", ORANGE, "line"),
                ]
            )
            + chart
            + "</div>"
        )
    return "".join(out)


RUN_HELP = r"""
<p>Open two PowerShell windows.</p>
<p><b>Window 1: the engine (API)</b></p>
<pre>cd C:\Users\ggrea\cdc2026\CDC26\backend
.venv\Scripts\python -m uvicorn conflict_sim.api.app:app --port 8000</pre>
<p>Check it at <a href="http://localhost:8000/docs">http://localhost:8000/docs</a>.
First time on a new machine, set up the environment first:</p>
<pre>cd C:\Users\ggrea\cdc2026\CDC26\backend
python -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
.venv\Scripts\python scripts\fetch_wb_dev.py        # dev data pull (~1 min)
.venv\Scripts\python -m conflict_sim.estimation     # rebuild estimates (~10 min)
.venv\Scripts\python -m conflict_sim.backtest       # scorecard used by the page</pre>
<p><b>Window 2: the explorer page</b></p>
<pre>cd C:\Users\ggrea\cdc2026\CDC26\frontend
npm ci                      # first time only
npx vite --port 5180</pre>
<p>Then open <a href="http://localhost:5180/explorer.html">http://localhost:5180/explorer.html</a>.
Port 5180 is used because 5173 is taken by another app on this machine.</p>
<p><b>Rebuild this report</b></p>
<pre>cd C:\Users\ggrea\cdc2026\CDC26\backend
.venv\Scripts\python -m conflict_sim.report
start reports\inspect.html</pre>
"""

CSS = """
:root{color-scheme:light;--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--text2:#52514e;--muted:#898781;
--grid:#e1e0d9;--axisc:#c3c2b7;--border:rgba(11,11,11,.1);--s1:#2a78d6;--s2:#eb6834;--bad:#d03b3b;
--good:#2a78d6;--war:rgba(227,73,72,.08);--before:rgba(137,135,129,.12)}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#fff;
--text2:#c3c2b7;--grid:#2c2c2a;--axisc:#383835;--border:rgba(255,255,255,.1);--s1:#3987e5;--s2:#d95926;
--bad:#e66767;--good:#3987e5;--war:rgba(230,103,103,.1);--before:rgba(137,135,129,.18)}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);
font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1060px;margin:0 auto;padding:40px 16px 80px}
h1{font-size:32px;margin:0 0 6px}h2{font-size:22px;margin:48px 0 6px}h3{font-size:17px;margin:0 0 8px}
.lede{color:var(--text2);max-width:72ch}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:24px 0}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.tile b{display:block;font-size:26px}.tile span{color:var(--text2);font-size:14px}
figure{margin:20px 0;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px}
.fig-title{font-weight:650;margin-bottom:4px}
.caption{color:var(--text2);margin:8px 0 0;max-width:80ch}
svg.chart{width:100%;height:auto;display:block;overflow:visible}
.grid{stroke:var(--grid);stroke-width:1}.axis{stroke:var(--axisc);stroke-width:1}
.vline{stroke:var(--axisc);stroke-width:1}
.tick{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.zone-war{fill:var(--war)}.zone-before{fill:var(--before)}
.zone-label{fill:var(--muted);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.line{fill:none;stroke-linejoin:round;stroke-linecap:round}
.hit{opacity:0}.hit:hover{opacity:1;stroke:var(--surface);stroke-width:2}
.dot{stroke:var(--surface);stroke-width:2}
.badge{font-size:10.5px;font-weight:700;letter-spacing:.05em}.badge.bad{fill:var(--bad)}.badge.ok{fill:var(--muted)}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--text2);margin:4px 0 8px}
.lg{display:inline-flex;align-items:center;gap:6px}
.key{display:inline-block;width:16px;height:3px;border-radius:2px}.key.band{height:10px;opacity:.35}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-top:8px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 12px}
.card.out{border-color:var(--bad);box-shadow:inset 3px 0 0 var(--bad)}
.card-title{font-weight:650}.card-sub{font-size:12.5px;color:var(--text2);margin-bottom:4px}
.bar-good{fill:var(--good)}.bar-bad{fill:var(--bad)}
.bar-label,.bar-value{fill:var(--text2);font-size:12px}.bar-value{font-variant-numeric:tabular-nums}
.example{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;margin:16px 0}
.example ol{padding-left:20px;max-width:80ch}.example li{margin:6px 0}
pre{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;
overflow-x:auto;font-size:13.5px}
a{color:var(--s1)}
"""


def build_report(real: Ctx, syn: Ctx, out: Path) -> dict[str, Any]:
    syn_html, syn_stats = section_synthetic(syn)
    curves_html, curve_stats = section_curves(real)
    rows = backtest_rows(real)
    bt_html = section_backtest(rows)
    score_html, score_stats = section_scorecard(rows)
    ex_html = section_examples(real)
    n_in = sum(r["inside"] for r in rows)
    tiles = [
        (f"{syn_stats['inside']}/11", "years the fake-data truth fell inside our range"),
        ("passes" if curve_stats["leads_clean"] else "fails", "before-war honesty check"),
        (f"{n_in}/{len(rows)}", "real wars inside our 90% range (ideal ~90%)"),
        (f"{score_stats['wins']}/{score_stats['n']}", "wars where we beat 'assume no war'"),
    ]
    body = f"""
<main>
<h1>How good is the war-cost model?</h1>
<p class="lede">Generated {datetime.now():%Y-%m-%d %H:%M} from {escape(real.label.replace("_", " "))} data
({real.artifacts.meta.get("n_countries", "?")} countries). Every chart below comes with a plain-English note
on what to look for. The model finds patterns in past wars; it shows what usually comes with a war,
not proof that the war caused every change.</p>
<div class="summary">{"".join(f'<div class="tile"><b>{escape(a)}</b><span>{escape(b)}</span></div>' for a, b in tiles)}</div>
<h2>1. Can it find an answer we already know?</h2>
<p class="lede">Before trusting the model on real wars, we test it on made-up data where we know the right answer.</p>
{syn_html}
<h2>2. What the model thinks a war does</h2>
{curves_html}
<h2>3. Every past war we tested</h2>
{bt_html}
<h2>4. Do we beat a simple guess?</h2>
{score_html}
<h2>5. Three worked examples, step by step</h2>
{ex_html}
<h2>6. Run it yourself (Windows)</h2>
{RUN_HELP}
</main>"""
    html = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>Model inspection report</title><style>{CSS}</style></head><body>{body}</body></html>"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return {
        "synthetic": syn_stats,
        "curves": curve_stats,
        "scorecard": score_stats,
        "backtest_inside": n_in,
        "backtest_n": len(rows),
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    cfg = default_config()
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--draws", type=int, default=200, help="bootstrap draws for the synthetic check"
    )
    ap.add_argument("--out", type=Path, default=BACKEND_DIR / "reports" / "inspect.html")
    args = ap.parse_args()
    real = load_ctx(cfg, None, cfg.artifacts_dir)
    with tempfile.TemporaryDirectory() as tmp:
        log.info("estimating on the synthetic fixture (%d draws)...", args.draws)
        logging.getLogger("conflict_sim").setLevel(logging.WARNING)
        run_estimation(cfg, "fixture", args.draws, Path(tmp))
        syn = load_ctx(cfg, "fixture", Path(tmp))
        stats = build_report(real, syn, args.out)
    logging.getLogger("conflict_sim").setLevel(logging.INFO)
    log.info("wrote %s  %s", args.out, stats)


if __name__ == "__main__":
    main()
