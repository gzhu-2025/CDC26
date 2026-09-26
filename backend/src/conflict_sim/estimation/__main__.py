"""`make estimate`: rebuild artifacts/ (LP point estimates + cluster bootstrap draws).

python -m conflict_sim.estimation [--source fixture|PATH] [--draws N] [--out DIR]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from conflict_sim.config import Config, default_config
from conflict_sim.estimation import MEASURES, OUTCOMES
from conflict_sim.estimation.bootstrap import bootstrap_paths
from conflict_sim.estimation.lp import estimate_terms
from conflict_sim.io import load_country_meta, load_indicators, resolve_indicators_path
from conflict_sim.simulation.artifacts import bootstrap_path, estimates_path, meta_path
from conflict_sim.simulation.simulator import own_effect
from conflict_sim.transforms import Panel, build_panel, sample_mask

log = logging.getLogger("conflict_sim.estimate")


def sanity_check(
    gdp_draws: np.ndarray,
    horizons: np.ndarray,
    cfg: Config,
    gamma_draws: np.ndarray | None = None,
) -> dict[str, Any]:
    """Median GDP gap for the reference scenario; logs a warning (never fails) if out of band."""
    s = cfg.sanity
    post = horizons >= 0
    effect = own_effect(
        gdp_draws[:, post],
        None if gamma_draws is None else gamma_draws[:, post],
        s.duration_years,
        s.horizon,
        s.intensity_per_100k,
        scale=cfg.conflict.intensity_scale,
    )
    gap = float(np.median(np.expm1(effect[:, s.horizon])))
    ok = s.gdp_gap_band[0] <= gap <= s.gdp_gap_band[1]
    if not ok:
        log.warning(
            "SANITY: %d-yr conflict at %g/100k implies median GDP pc gap %.1f%% at h=%d; "
            "expected band [%.0f%%, %.0f%%]",
            s.duration_years,
            s.intensity_per_100k,
            gap * 100,
            s.horizon,
            s.gdp_gap_band[0] * 100,
            s.gdp_gap_band[1] * 100,
        )
    return {"gdp_gap_median": gap, "within_band": ok, **s.model_dump()}


def _add_boot_ci(rows: list[dict[str, Any]], draws: np.ndarray, level: float) -> None:
    lo, hi = np.nanpercentile(draws, [50 * (1 - level), 50 * (1 + level)], axis=0)
    for j, r in enumerate(rows):
        r["boot_ci_low"], r["boot_ci_high"] = float(lo[j]), float(hi[j])


def run(cfg: Config, source: str | None, n_draws: int, out: Path) -> dict[str, Any]:
    path, label = resolve_indicators_path(cfg, source)
    log.info("data: %s (%s)", path, label)
    long, load_warnings = load_indicators(path)
    panel: Panel = build_panel(long, cfg, load_country_meta(cfg, path, label))
    out.mkdir(parents=True, exist_ok=True)
    horizons = np.array(cfg.lp.horizons)
    measures = list(MEASURES)
    sanity: dict[str, Any] = {}
    terms: list[str] = []
    pretrend: list[dict[str, Any]] = []

    for outcome in OUTCOMES:
        t0 = time.perf_counter()
        est: dict[str, list[dict[str, Any]]] = {}
        for m in measures:
            for term, rows in estimate_terms(panel, cfg, outcome, m).items():
                est[m if term == "shock" else f"{m}_{term}"] = rows
        draws = bootstrap_paths(panel, cfg, outcome, measures, n_draws, cfg.bootstrap.seed)
        for key, rows in est.items():
            _add_boot_ci(rows, draws[key], cfg.lp.ci_level)
        for m in measures:
            pretrend += [
                {"outcome": outcome, "measure": m, "h": r["h"], "p_value": r["p_value"]}
                for r in est[m]
                if r["is_lead"] and r["p_value"] < 0.05
            ]
        np.savez_compressed(bootstrap_path(out, outcome), horizons=horizons, **draws)
        estimates_path(out, outcome).write_text(json.dumps(est, indent=2))
        log.info("%s done in %.1fs", outcome, time.perf_counter() - t0)
        if outcome == "gdp":
            m = cfg.conflict.measure
            sanity = sanity_check(draws[m], horizons, cfg, draws.get(f"{m}_shock_age"))
            terms = sorted(draws)

    df = panel.df[sample_mask(panel, cfg)]
    conflict_years = df.loc[df["conflict"] == 1, "deaths_per_100k"]
    meta = {
        "source": label,
        "data_path": str(path),
        "data_sha256": hashlib.sha256(path.read_bytes()).hexdigest()[:16],
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "n_draws": n_draws,
        "horizons": horizons.tolist(),
        "measures": measures,
        "gdp_terms": terms,
        "spatial": {"enabled": panel.has_spatial, "kernel_km": cfg.spatial.kernel_km},
        "simulator_measure": cfg.conflict.measure,
        "n_countries": int(df.index.get_level_values("iso3").nunique()),
        "years": [cfg.sample.start_year, cfg.sample.end_year],
        "deaths_first_year": panel.deaths_first_year,
        "fdi_winsor_bounds": list(panel.fdi_winsor_bounds),
        "intensity_p99_per_100k": float(conflict_years.quantile(0.99)),
        "pretrend_significant": pretrend,
        "sanity": sanity,
        "load_warnings": load_warnings,
        "config": cfg.model_dump(),
        "note": "Associational estimates (two-way FE local projections), not causal effects.",
    }
    meta_path(out).write_text(json.dumps(meta, indent=2))
    return meta


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = default_config()
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=None, help="'fixture' or a parquet path (default: config)")
    ap.add_argument("--draws", type=int, default=cfg.bootstrap.n_draws)
    ap.add_argument("--out", type=Path, default=cfg.artifacts_dir)
    args = ap.parse_args()
    meta = run(cfg, args.source, args.draws, args.out)
    log.info("artifacts -> %s | sanity %s", args.out, meta["sanity"])


if __name__ == "__main__":
    main()
