"""Local projections (Jorda 2005) with country + year FE, SEs clustered by country.

Associational, not causal: beta_h is the conditional correlation between conflict and
subsequent outcome changes after fixed effects and controls. See estimation/__init__.py.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
from linearmodels.panel import PanelOLS
from scipy import stats

from conflict_sim.config import Config
from conflict_sim.estimation.design import Design, build_design
from conflict_sim.transforms import Panel

log = logging.getLogger(__name__)


def fit_panelols(design: Design, term: str = "shock") -> dict[str, Any]:
    return fit_panelols_terms(design)[term]


def fit_panelols_terms(design: Design) -> dict[str, dict[str, Any]]:
    """{key term: {beta, se, p_value, nobs, n_countries}}"""
    dep, exog = design.frame()
    res = PanelOLS(dep, exog, entity_effects=True, time_effects=True, drop_absorbed=True).fit(
        cov_type="clustered", cluster_entity=True
    )
    return {
        t: {
            "beta": float(res.params[t]),
            "se": float(res.std_errors[t]),
            "p_value": float(res.pvalues[t]),
            "nobs": int(res.nobs),
            "n_countries": len(np.unique(design.iso3)),
        }
        for t in design.key_terms
    }


def estimate_terms(
    panel: Panel, cfg: Config, outcome: str, measure: str
) -> dict[str, list[dict[str, Any]]]:
    """{key term: [row per horizon]}; 'shock' is the main beta path."""
    z = stats.norm.ppf(0.5 + cfg.lp.ci_level / 2)
    out: dict[str, list[dict[str, Any]]] = {}
    for h in cfg.lp.horizons:
        for term, r in fit_panelols_terms(build_design(panel, cfg, outcome, measure, h)).items():
            r.update(
                h=h, is_lead=h < 0, ci_low=r["beta"] - z * r["se"], ci_high=r["beta"] + z * r["se"]
            )
            out.setdefault(term, []).append(r)
    return out


def estimate_path(panel: Panel, cfg: Config, outcome: str, measure: str) -> list[dict[str, Any]]:
    rows = estimate_terms(panel, cfg, outcome, measure)["shock"]
    for r in rows:
        log.info(
            "%s/%s h=%+d beta=%.4f se=%.4f n=%d",
            outcome,
            measure,
            r["h"],
            r["beta"],
            r["se"],
            r["nobs"],
        )
    return rows
