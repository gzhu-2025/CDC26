"""Country cluster bootstrap: resample countries with replacement and re-estimate the full
beta path (all horizons) on each draw. Duplicated countries become distinct clusters."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from conflict_sim.config import Config
from conflict_sim.estimation.design import Design, build_design
from conflict_sim.estimation.fe_solver import twoway_fe_ols
from conflict_sim.transforms import Panel

log = logging.getLogger(__name__)


class _Prepared:
    """One horizon's design with rows grouped by country for fast resampling."""

    def __init__(self, design: Design, countries: list[str]) -> None:
        self.y = design.dep
        self.X = design.exog
        self.n_key = len(design.key_terms)
        self.time_codes = pd.factorize(design.year, sort=True)[0]
        pos = {c: i for i, c in enumerate(countries)}
        codes = np.array([pos[c] for c in design.iso3])
        order = np.argsort(codes, kind="stable")
        bounds = np.searchsorted(codes[order], np.arange(len(countries) + 1))
        self.rows = [order[bounds[i] : bounds[i + 1]] for i in range(len(countries))]

    def solve(self, draw: np.ndarray) -> np.ndarray:
        """Key-term coefficients for one resample."""
        parts = [self.rows[c] for c in draw]
        idx = np.concatenate(parts)
        if len(idx) == 0:
            return np.full(self.n_key, np.nan)
        entity = np.repeat(np.arange(len(draw)), [len(p) for p in parts])
        time = pd.factorize(self.time_codes[idx], sort=True)[0]
        return twoway_fe_ols(self.y[idx], self.X[idx], entity, time)[: self.n_key]


def bootstrap_paths(
    panel: Panel, cfg: Config, outcome: str, measures: list[str], n_draws: int, seed: int
) -> dict[str, np.ndarray]:
    """{measure or measure_term: (n_draws, n_horizons)}. Keys: 'continuous' (beta),
    'continuous_shock_age' (gamma), 'continuous_spill' (delta), 'onset'. The same country
    draws are used for every term and horizon, so each row is a coherent path."""
    horizons = cfg.lp.horizons
    designs = {m: [build_design(panel, cfg, outcome, m, h) for h in horizons] for m in measures}
    countries = sorted(set().union(*(set(d.iso3) for ds in designs.values() for d in ds)))
    prepared = {m: [_Prepared(d, countries) for d in ds] for m, ds in designs.items()}

    rng = np.random.default_rng(seed)
    draws = rng.integers(0, len(countries), size=(n_draws, len(countries)))
    terms = {m: designs[m][0].key_terms for m in measures}
    key = {(m, t): m if t == "shock" else f"{m}_{t}" for m in measures for t in terms[m]}
    out = {k: np.empty((n_draws, len(horizons))) for k in key.values()}
    for b in range(n_draws):
        for m in measures:
            for j, p in enumerate(prepared[m]):
                coefs = p.solve(draws[b])
                for i, t in enumerate(terms[m]):
                    out[key[(m, t)]][b, j] = coefs[i]
        if (b + 1) % 100 == 0:
            log.info("%s bootstrap %d/%d", outcome, b + 1, n_draws)
    return out
