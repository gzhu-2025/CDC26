"""Leave-one-war-out backtest (out-of-sample), cached by data + config hash.

    python -m conflict_sim.lowo [--draws 200] [--variant pooled]

For each backtest war, the war country's GDP outcomes are removed from estimation (the
whole country is held out, which also rules out leakage through the 8-year lag controls),
the GDP model is re-estimated with a cluster bootstrap, and the war is predicted from data
before its start. Its conflict still enters neighbors' exposure (an input, not an outcome).

Also fits a band-widening calibration factor k: the multiplier on the log-distance from the
median to the 5%/95% bounds that would put 90% of held-out outcomes inside the range.
"""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import logging
import os
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np
import pandas as pd

from conflict_sim.backtest import select_episodes
from conflict_sim.config import Config, default_config
from conflict_sim.estimation.bootstrap import bootstrap_paths
from conflict_sim.io import load_country_meta, load_indicators, resolve_indicators_path
from conflict_sim.simulation.artifacts import Artifacts
from conflict_sim.simulation.simulator import Simulator
from conflict_sim.transforms import Panel, build_panel

log = logging.getLogger(__name__)
CODE_VERSION = "lowo-1"


def cache_key(
    cfg: Config, data_path: Path, n_draws: int, variant: str, extra_files: tuple[Path, ...] = ()
) -> str:
    h = hashlib.sha256()
    for f in (data_path, *extra_files):
        h.update(hashlib.sha256(f.read_bytes()).digest())
    h.update(json.dumps(cfg.model_dump(), sort_keys=True, default=str).encode())
    h.update(f"{n_draws}|{variant}|{CODE_VERSION}".encode())
    return h.hexdigest()[:16]


def hold_out(panel: Panel, iso3: str) -> Panel:
    """Same panel, but the country's GDP outcomes are missing (so it never enters estimation)."""
    df = panel.df.copy()
    rows = df.index.get_level_values("iso3") == iso3
    df.loc[rows, ["lngdp", "dlngdp"]] = np.nan
    return dataclasses.replace(panel, df=df)


def _aligned(draws: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    ok = np.all([~np.isnan(a).any(axis=1) for a in draws.values()], axis=0)
    return {k: a[ok] for k, a in draws.items()}


def run_fold(
    panel: Panel,
    full: Artifacts,
    cfg: Config,
    ep: Any,
    n_draws: int,
    seed: int,
    estimate: Any = None,
) -> dict[str, Any] | None:
    ho = hold_out(panel, ep.iso3)
    estimate = estimate or (lambda p: bootstrap_paths(p, cfg, "gdp", ["continuous"], n_draws, seed))
    gdp = _aligned(estimate(ho))
    art = Artifacts(
        horizons=full.horizons,
        draws={"gdp": gdp, "fdi": full.draws["fdi"]},
        estimates=full.estimates,
        meta=full.meta,
    )
    try:
        res, _ = Simulator(panel, art, cfg).simulate(
            ep.iso3,
            int(ep.start),
            int(min(ep.duration, 20)),
            float(ep.intensity),
            horizon=int(ep.horizon),
            n_sims=4000,
            seed=0,
        )
    except (ValueError, KeyError):
        return None
    g = res["gdp_pc"]
    actual = g["actual"][-1]
    if actual is None:
        return None
    s = g["scenario"]
    years = res["years"]
    return {
        "iso3": ep.iso3,
        "start": int(ep.start),
        "duration": int(ep.duration),
        "intensity": float(ep.intensity),
        "horizon": int(ep.horizon),
        "years": years,
        "actual_path": g["actual"],
        "war_p5": s["p5"],
        "war_p50": s["p50"],
        "war_p95": s["p95"],
        "nowar_p50": g["baseline"]["p50"],
        "actual": actual,
        "war_end": s["p50"][-1],
        "nowar_end": g["baseline"]["p50"][-1],
        "lo_end": s["p5"][-1],
        "hi_end": s["p95"][-1],
        "in_90": s["p5"][-1] <= actual <= s["p95"][-1],
        "log_err": float(np.log(actual) - np.log(s["p50"][-1])),
        "log_err_no_war": float(np.log(actual) - np.log(g["baseline"]["p50"][-1])),
    }


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    df = pd.DataFrame(rows)
    # z = distance from the median in units of the (log) half-width on the actual's side
    up = np.log(df["hi_end"]) - np.log(df["war_end"])
    down = np.log(df["war_end"]) - np.log(df["lo_end"])
    err = df["log_err"]
    half = np.where(err >= 0, up, down)
    z = np.abs(err) / np.maximum(half, 1e-9)
    k = float(max(1.0, np.quantile(z, 0.9)))
    wins = int((df["log_err"].abs() < df["log_err_no_war"].abs()).sum())
    return {
        "n_wars": len(df),
        "coverage_90": float(df["in_90"].mean()),
        "wins_vs_no_war": wins,
        "median_abs_log_err": float(df["log_err"].abs().median()),
        "median_abs_log_err_no_war": float(df["log_err_no_war"].abs().median()),
        "mean_log_err": float(df["log_err"].mean()),
        "band_calibration_k": k,
        "coverage_after_calibration": float((z <= k).mean()),
    }


# ---- parallel folds: each worker process loads the data once ----
_CTX: dict[str, Any] = {}


def _init_worker(variant: str, n_draws: int) -> None:
    logging.disable(logging.INFO)
    cfg = default_config()
    path, label = resolve_indicators_path(cfg)
    long, _ = load_indicators(path)
    panel = build_panel(long, cfg, load_country_meta(cfg, path, label))
    factory = None
    if variant != "pooled":
        from conflict_sim.heterogeneity import make_factory  # avoid a circular import

        factory = make_factory(variant, cfg, n_draws)
    _CTX.update(
        cfg=cfg,
        panel=panel,
        full=Artifacts.load(cfg.artifacts_dir),
        factory=factory,
        n_draws=n_draws,
    )


def _run_one(ep_fields: dict[str, Any]) -> dict[str, Any] | None:
    c = _CTX
    ep = SimpleNamespace(**ep_fields)
    est = c["factory"](c["panel"], ep) if c["factory"] else None
    return run_fold(c["panel"], c["full"], c["cfg"], ep, c["n_draws"], c["cfg"].bootstrap.seed, est)


def run(
    cfg: Config,
    n_draws: int = 200,
    variant: str = "pooled",
    out_dir: Path | None = None,
    estimate_factory: Any = None,
    extra_files: tuple[Path, ...] = (),
    workers: int = 1,
) -> dict[str, Any]:
    out_dir = out_dir or cfg.artifacts_dir / "lowo"
    out_dir.mkdir(parents=True, exist_ok=True)
    path, label = resolve_indicators_path(cfg)
    key = cache_key(cfg, path, n_draws, variant, extra_files)
    cache = out_dir / f"{variant}.json"
    if cache.exists():
        cached = json.loads(cache.read_text())
        if cached.get("key") == key:
            log.info("lowo %s: cache hit (%s)", variant, cached["created_at"])
            return cached
    long, _ = load_indicators(path)
    panel = build_panel(long, cfg, load_country_meta(cfg, path, label))
    full = Artifacts.load(cfg.artifacts_dir)
    eps = select_episodes(panel, cfg)
    rows = []
    t0 = time.perf_counter()
    if workers > 1:
        # one BLAS thread per worker; children read these at numpy import
        for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
            os.environ[var] = "1"
        fields = [dict(zip(eps.columns, row, strict=True)) for row in eps.itertuples(index=False)]
        with ProcessPoolExecutor(
            workers, initializer=_init_worker, initargs=(variant, n_draws)
        ) as ex:
            rows = [r for r in ex.map(_run_one, fields) if r]
        log.info(
            "lowo %s: %d wars in %.0fs (%d workers)",
            variant,
            len(rows),
            time.perf_counter() - t0,
            workers,
        )
    for i, ep in enumerate(eps.itertuples(), 1) if workers <= 1 else []:
        est = estimate_factory(panel, ep) if estimate_factory else None
        r = run_fold(panel, full, cfg, ep, n_draws, cfg.bootstrap.seed, est)
        if r:
            rows.append(r)
        log.info(
            "lowo %s %d/%d %s %s (%.0fs)",
            variant,
            i,
            len(eps),
            ep.iso3,
            ep.start,
            time.perf_counter() - t0,
        )
    result = {
        "key": key,
        "variant": variant,
        "n_draws": n_draws,
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "holdout": "whole country's GDP outcomes removed from estimation",
        "summary": summarize(rows),
        "wars": rows,
    }
    cache.write_text(json.dumps(result, indent=1, default=float))
    return result


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--draws", type=int, default=200)
    ap.add_argument("--variant", default="pooled")
    ap.add_argument("--workers", type=int, default=1)
    args = ap.parse_args()
    res = run(default_config(), args.draws, args.variant, workers=args.workers)
    log.info("summary: %s", res["summary"])


if __name__ == "__main__":
    main()
