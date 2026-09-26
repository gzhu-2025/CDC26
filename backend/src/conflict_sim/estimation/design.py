"""Local-projection design matrices.

For h >= 0 (base year t-1):
    y[t+h] - y[t-1] = a_i + g_t + beta_h * c[t] + sum_k phi_k dy[t-k]          (spec)
                      + sum_l psi_l x[t-l]           (continuous: past conflict)
                      + sum_j rho_j x[t+j], j=1..h   (continuous: future conflict)
Continuous measure only, two extra key terms:
    + gamma_h * x[t] * log1p(war_age[t])   diminishing damage in long wars
    + delta_h * spill[t]                    distance-weighted conflict in neighboring countries
each with its own past/future controls.
The extra conflict blocks make beta_h the response to ONE isolated conflict-year
(Teulings & Zubanov 2014), so the simulator can superpose per-year effects without
double counting conflict persistence.

For leads h < 0 the base y[t-1] from the spec is degenerate (y[t+h] - y[t-1] is an exact
linear combination of the dy[t-1], dy[t-2] controls, forcing beta = 0), so leads use base
t-B (B = lead_base_offset) with dy controls dated at the new base.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from conflict_sim.config import Config
from conflict_sim.estimation import MEASURES, OUTCOMES
from conflict_sim.transforms import Panel, sample_mask


@dataclass(frozen=True)
class Design:
    h: int
    dep: np.ndarray  # (n,)
    exog: np.ndarray  # (n, k); column 0 is the conflict measure
    names: list[str]  # the first len(key_terms) columns are the key terms
    iso3: np.ndarray  # (n,) str
    year: np.ndarray  # (n,) int
    key_terms: tuple[str, ...] = ("shock",)

    @property
    def nobs(self) -> int:
        return len(self.dep)

    def frame(self) -> tuple[pd.Series, pd.DataFrame]:
        idx = pd.MultiIndex.from_arrays([self.iso3, self.year], names=["iso3", "year"])
        return pd.Series(self.dep, idx, name="dep"), pd.DataFrame(self.exog, idx, self.names)


def key_terms(panel: Panel, cfg: Config, measure: str, outcome: str) -> tuple[str, ...]:
    """Coefficients stored per horizon: shock (beta), shock_age (gamma), spill (delta).
    The extra terms apply to the continuous measure and outcomes in lp.extra_terms_outcomes."""
    if measure != "continuous" or outcome not in cfg.lp.extra_terms_outcomes:
        return ("shock",)
    terms = ["shock"]
    if cfg.lp.duration_interaction:
        terms.append("shock_age")
    if panel.has_spatial and panel.df["spill"].notna().any():
        terms.append("spill")
    return tuple(terms)


def build_design(panel: Panel, cfg: Config, outcome: str, measure: str, h: int) -> Design:
    level_col, diff_col = OUTCOMES[outcome]
    df = panel.df
    g = df.groupby(level="iso3")

    def sh(col: str, k: int) -> pd.Series:  # value at t - k
        return g[col].shift(k)

    base = 1 if h >= 0 else cfg.lp.lead_base_offset
    cols: dict[str, pd.Series] = {"dep": sh(level_col, -h) - sh(level_col, base)}
    terms = key_terms(panel, cfg, measure, outcome)
    source = {"shock": MEASURES[measure], "shock_age": "x_age", "spill": "spill"}
    for t in terms:
        cols[t] = df[source[t]]
    for k in range(cfg.lp.n_outcome_lags):
        cols[f"dy_l{base + k}"] = sh(diff_col, base + k)
    if measure == "continuous":
        n_lags = {
            "shock": cfg.lp.n_conflict_lags,
            "shock_age": cfg.lp.n_conflict_lags,
            "spill": cfg.spatial.n_spill_lags,
        }
        for t in terms:
            for lag in range(1, n_lags[t] + 1):
                cols[f"{t}_l{lag}"] = sh(source[t], lag)
            if cfg.lp.future_shock_controls and h > 0:
                for lead in range(1, h + 1):
                    cols[f"{t}_f{lead}"] = sh(source[t], -lead)

    frame = pd.DataFrame(cols)[sample_mask(panel, cfg)].dropna()
    names = [c for c in frame.columns if c != "dep"]
    return Design(
        h=h,
        dep=frame["dep"].to_numpy(float),
        exog=frame[names].to_numpy(float),
        names=names,
        iso3=frame.index.get_level_values("iso3").to_numpy(),
        year=frame.index.get_level_values("year").to_numpy(int),
        key_terms=terms,
    )
