"""Backtest scorecard: replay real conflict episodes and score the simulator against what
actually happened.

    python -m conflict_sim.backtest [--artifacts DIR] [--out FILE]

Caveat: episodes are also in the estimation sample (in-sample test), so scores are
optimistic. Use them to compare model variants, not as a forecast-accuracy claim.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from conflict_sim.config import Config, default_config
from conflict_sim.io import load_country_meta, load_indicators, resolve_indicators_path
from conflict_sim.simulation.artifacts import Artifacts
from conflict_sim.simulation.simulator import Simulator
from conflict_sim.transforms import Panel, build_panel, conflict_episodes

log = logging.getLogger(__name__)


def select_episodes(panel: Panel, cfg: Config) -> pd.DataFrame:
    b = cfg.backtest
    eps = conflict_episodes(panel, cfg.conflict.merge_gap_years)
    last_gdp = panel.df["gdp"].dropna().reset_index().groupby("iso3")["year"].max()
    eps["last_gdp_year"] = eps["iso3"].map(last_gdp)
    eps["horizon"] = np.minimum(10, eps["last_gdp_year"] - eps["start"])
    keep = (
        (eps["start"] >= b.min_onset_year)
        & (eps["intensity"] >= b.min_intensity_per_100k)
        & (eps["horizon"] >= b.min_horizon)
    )
    return eps[keep].reset_index(drop=True)


def run_backtest(sim: Simulator, episodes: pd.DataFrame) -> dict[str, Any]:
    rows = []
    for e in episodes.itertuples():
        try:
            res, _ = sim.simulate(
                e.iso3,
                int(e.start),
                int(min(e.duration, 20)),
                float(e.intensity),
                horizon=int(e.horizon),
                n_sims=4000,
                seed=0,
            )
        except (ValueError, KeyError) as err:
            log.info("skip %s %s: %s", e.iso3, e.start, err)
            continue
        g = res["gdp_pc"]
        actual = g["actual"][-1]
        if actual is None:
            continue
        s = g["scenario"]
        rows.append(
            {
                "iso3": e.iso3,
                "start": int(e.start),
                "duration": int(e.duration),
                "intensity": round(float(e.intensity), 1),
                "horizon": int(e.horizon),
                "actual": actual,
                "scenario_p50": s["p50"][-1],
                "baseline_p50": g["baseline"]["p50"][-1],
                "in_90": s["p5"][-1] <= actual <= s["p95"][-1],
                "in_50": s["p25"][-1] <= actual <= s["p75"][-1],
                "log_err": float(np.log(actual) - np.log(s["p50"][-1])),
                "log_err_no_war": float(np.log(actual) - np.log(g["baseline"]["p50"][-1])),
            }
        )
    df = pd.DataFrame(rows)
    return {
        "n_episodes": len(df),
        "hit_rate_90": float(df["in_90"].mean()),
        "hit_rate_50": float(df["in_50"].mean()),
        "median_abs_log_err": float(df["log_err"].abs().median()),
        "median_abs_log_err_no_war_model": float(df["log_err_no_war"].abs().median()),
        "mean_log_err": float(df["log_err"].mean()),
        "episodes": df.to_dict("records"),
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    cfg = default_config()
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifacts", type=Path, default=cfg.artifacts_dir)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    path, label = resolve_indicators_path(cfg)
    long, _ = load_indicators(path)
    panel = build_panel(long, cfg, load_country_meta(cfg, path, label))
    sim = Simulator(panel, Artifacts.load(args.artifacts), cfg)
    result = run_backtest(sim, select_episodes(panel, cfg))
    df = pd.DataFrame(result["episodes"])
    print(
        df[
            [
                "iso3",
                "start",
                "duration",
                "intensity",
                "horizon",
                "actual",
                "scenario_p50",
                "baseline_p50",
                "in_90",
                "log_err",
            ]
        ]
        .round(3)
        .to_string(index=False)
    )
    print(
        f"\nepisodes={result['n_episodes']}  in 90% range={result['hit_rate_90']:.0%}  "
        f"in 50% range={result['hit_rate_50']:.0%}  median |log err|="
        f"{result['median_abs_log_err']:.3f} (no-war model: "
        f"{result['median_abs_log_err_no_war_model']:.3f})  bias={result['mean_log_err']:+.3f}"
    )
    out = args.out or args.artifacts / "backtest.json"
    out.write_text(json.dumps(result, indent=2, default=float))


if __name__ == "__main__":
    main()
