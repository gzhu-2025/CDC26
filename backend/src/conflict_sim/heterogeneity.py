"""Pre-registered heterogeneity test (see backend/PREREGISTRATION.md).

    python -m conflict_sim.heterogeneity [--draws 200]

Runs both candidates through the same leave-one-war-out design as the pooled model and
applies the pass rule exactly as registered. Writes artifacts/lowo/heterogeneity.json.
Each candidate collapses to a country-specific effect path, so the simulator is unchanged.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import numpy as np
import pandas as pd

from conflict_sim import lowo
from conflict_sim.config import Config, default_config
from conflict_sim.estimation.bootstrap import bootstrap_paths
from conflict_sim.io import load_country_meta, resolve_indicators_path
from conflict_sim.transforms import Panel, sample_mask

log = logging.getLogger(__name__)
RENTS, AID = "NY.GDP.TOTL.RT.ZS", "DT.ODA.ODAT.GN.ZS"
PASS_WINS, N_WARS = 20, 29


# ---------- candidate 1: resource rents + aid interactions ----------
def add_covariate_terms(panel: Panel, cfg: Config, covariates: pd.DataFrame) -> Panel:
    """z measured the year before the current war began (non-war years: previous year),
    standardized over the estimation sample, missing -> 0 (the sample mean)."""
    df = panel.df.copy()
    years = df.index.get_level_values("year").to_numpy()
    in_war = (df["conflict"] == 1).to_numpy()
    ref_year = np.where(in_war, years - df["war_age"].fillna(0).to_numpy() - 1, years - 1)
    ref_idx = pd.MultiIndex.from_arrays([df.index.get_level_values("iso3"), ref_year])
    mask = sample_mask(panel, cfg).to_numpy()
    for code, col in ((RENTS, "rents"), (AID, "aid")):
        raw = covariates[covariates["indicator"] == code].set_index(["iso3", "year"])["value"]
        z = raw.reindex(ref_idx).to_numpy()
        mu, sd = np.nanmean(z[mask]), np.nanstd(z[mask])
        z = np.nan_to_num((z - mu) / (sd or 1.0))
        df[f"z_{col}"] = z
        df[f"x_{col}"] = df["x"] * z
    return dataclasses.replace(panel, df=df)


def interactions_factory(cfg: Config, n_draws: int, covariates: pd.DataFrame) -> Callable:
    extra = {"shock_rents": "x_rents", "shock_aid": "x_aid"}

    def factory(panel: Panel, ep: Any) -> Callable:
        def estimate(ho: Panel) -> dict[str, np.ndarray]:
            p = add_covariate_terms(ho, cfg, covariates)
            d = bootstrap_paths(p, cfg, "gdp", ["continuous"], n_draws, cfg.bootstrap.seed, extra)
            before = p.country(ep.iso3).loc[int(ep.start) - 1]  # year before this war began
            zr = float(np.nan_to_num(before.get("z_rents", 0.0)))
            za = float(np.nan_to_num(before.get("z_aid", 0.0)))
            beta = (
                d["continuous"] + d["continuous_shock_rents"] * zr + d["continuous_shock_aid"] * za
            )
            return {
                "continuous": beta,
                "continuous_shock_age": d["continuous_shock_age"],
                "continuous_spill": d["continuous_spill"],
            }

        return estimate

    return factory


# ---------- candidate 2: regional empirical-Bayes shrinkage ----------
def eb_shrink(region_draws: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """Shrink each region's path toward the precision-weighted mean path, per horizon:
    shrunk = mu + tau2 / (tau2 + se2_r) * (b_r - mu); tau2 by method of moments (>= 0)."""
    regions = list(region_draws)
    means = np.array([region_draws[r].mean(axis=0) for r in regions])  # (R, H)
    se2 = np.array([region_draws[r].var(axis=0, ddof=1) for r in regions])
    tau2 = np.maximum(0.0, means.var(axis=0, ddof=1) - se2.mean(axis=0))  # (H,)
    w = 1.0 / (se2 + tau2 + 1e-12)
    mu = (w * means).sum(axis=0) / w.sum(axis=0)
    out = {}
    for i, r in enumerate(regions):
        b = tau2 / (tau2 + se2[i] + 1e-12)
        out[r] = mu + b * (region_draws[r] - mu)
    return out


def regional_factory(cfg: Config, n_draws: int, regions: pd.Series) -> Callable:
    counts = regions.value_counts()
    reference = str(counts.index[0])  # largest region is the reference category
    others = [r for r in counts.index if r != reference]
    slug = {r: f"r{i}" for i, r in enumerate(others)}
    extra = {f"shock_{slug[r]}": f"x_{slug[r]}" for r in others}

    def factory(panel: Panel, ep: Any) -> Callable:
        def estimate(ho: Panel) -> dict[str, np.ndarray]:
            df = ho.df.copy()
            reg = df.index.get_level_values("iso3").map(regions).to_numpy()
            for r in others:
                df[f"x_{slug[r]}"] = df["x"] * (reg == r)
            p = dataclasses.replace(ho, df=df)
            d = bootstrap_paths(p, cfg, "gdp", ["continuous"], n_draws, cfg.bootstrap.seed, extra)
            paths = {reference: d["continuous"]}
            for r in others:
                paths[r] = d["continuous"] + d[f"continuous_shock_{slug[r]}"]
            shrunk = eb_shrink(paths)
            own = regions.get(ep.iso3, reference)
            return {
                "continuous": shrunk.get(own, shrunk[reference]),
                "continuous_shock_age": d["continuous_shock_age"],
                "continuous_spill": d["continuous_spill"],
            }

        return estimate

    return factory


def make_factory(variant: str, cfg: Config, n_draws: int) -> Callable:
    """Build a candidate's estimate factory by name (used by parallel lowo workers)."""
    if variant == "interactions":
        cov = pd.read_parquet(cfg.resolve("dev_cache") / "covariates.parquet")
        return interactions_factory(cfg, n_draws, cov)
    if variant == "regional_eb":
        path, label = resolve_indicators_path(cfg)
        meta = load_country_meta(cfg, path, label)
        return regional_factory(cfg, n_draws, meta["region"].dropna())
    raise ValueError(variant)


# ---------- pass rule ----------
def evaluate(pooled: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    key = lambda w: (w["iso3"], w["start"])  # noqa: E731
    pool = {key(w): w for w in pooled["wars"]}
    cand = {key(w): w for w in candidate["wars"]}
    wins = sum(
        1 for k, pw in pool.items() if k in cand and abs(cand[k]["log_err"]) < abs(pw["log_err"])
    )  # a war the candidate could not simulate counts as a loss
    cov_p = pooled["summary"]["coverage_90"]
    cov_c = candidate["summary"]["coverage_90"]
    closer = abs(cov_c - 0.90) < abs(cov_p - 0.90)
    return {
        "variant": candidate["variant"],
        "wins_vs_pooled": wins,
        "n_wars": len(pool),
        "coverage_90": cov_c,
        "pooled_coverage_90": cov_p,
        "coverage_closer_to_90": closer,
        "passes": wins >= PASS_WINS and closer,
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--draws", type=int, default=200)
    ap.add_argument("--workers", type=int, default=10)
    args = ap.parse_args()
    cfg = default_config()
    pooled = lowo.run(cfg, args.draws, "pooled", workers=args.workers)
    results = []
    for variant in ("interactions", "regional_eb"):
        res = lowo.run(
            cfg,
            args.draws,
            variant,
            workers=args.workers,
            extra_files=(cfg.resolve("dev_cache") / "covariates.parquet",),
        )
        results.append(evaluate(pooled, res))
        log.info("%s: %s", variant, results[-1])
    passing = [r for r in results if r["passes"]]
    winner = max(passing, key=lambda r: r["wins_vs_pooled"]) if passing else None
    out = {
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "rule": f"passes if wins >= {PASS_WINS} of {N_WARS} held-out wars vs pooled AND "
        "90%-range coverage closer to 90% than pooled (PREREGISTRATION.md)",
        "candidates": results,
        "winner": None if winner is None else winner["variant"],
    }
    (cfg.artifacts_dir / "lowo" / "heterogeneity.json").write_text(json.dumps(out, indent=1))
    log.info("heterogeneity verdict: %s", out["winner"] or "no candidate passed")


if __name__ == "__main__":
    main()
