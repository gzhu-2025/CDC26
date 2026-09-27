"""Vectorized Monte Carlo conflict simulator (no Python loops over simulations).

Per simulation:
  1. draw one bootstrap beta path per outcome (parameter uncertainty),
  2. scale it by x = log1p(intensity per 100k / scale) and superpose over conflict years s:
       effect[r] = sum_{s=0}^{dur-1} x * (beta[r - s] + gamma[r - s] * log1p(age_s))
     where age_s = years into the war (gamma > 0 means later war years hurt less); valid
     because the LP isolates a one-year shock (see estimation/design.py);
     neighbors j get  spill_j[r] = w_ij * x * sum_s delta[r - s],
  3. baseline ("no-war path") = per-country ARIMA(p,1,q)-with-drift forecast of log GDP pc
     (config simulation.baseline_method; "trend" = mean peaceful growth + random walk);
     the SAME noise is used for scenario and baseline (common random numbers),
     so the gap reflects only conflict-effect and elasticity uncertainty,
  4. poverty: dln(P) = eta * dln(GDP pc), eta ~ U(eta_low, eta_high), clipped to [0, 100].
"""

from __future__ import annotations

from typing import Any

import numpy as np

from conflict_sim.config import Config
from conflict_sim.simulation.arima import ArimaFit, fit_log_gdp, simulate_growth
from conflict_sim.simulation.artifacts import Artifacts
from conflict_sim.simulation.baseline import build_baseline
from conflict_sim.transforms import Panel, intensity_to_x
from conflict_sim.warnings import Warn

QUANTILES = (5, 25, 50, 75, 95)
Q_KEYS = tuple(f"p{q}" for q in QUANTILES)


def superposition_matrix(duration: int, horizon: int, x: float | np.ndarray) -> np.ndarray:
    """C[k, r] = x_s for conflict year s = r - k in [0, duration), else 0. effect = beta @ C.
    ``x`` is a scalar or a per-conflict-year array of length ``duration``."""
    k = np.arange(horizon + 1)[:, None]
    r = np.arange(horizon + 1)[None, :]
    s = r - k
    per_year = np.broadcast_to(np.asarray(x, float), (duration,))
    inside = (s >= 0) & (s < duration)
    return np.where(inside, per_year[np.clip(s, 0, duration - 1)], 0.0)


def own_effect(
    beta: np.ndarray,
    gamma: np.ndarray | None,
    duration: int,
    horizon: int,
    intensity: float,
    age0: int = 0,
    scale: float = 1.0,
) -> np.ndarray:
    """(n, >=horizon+1) coefficient draws for h=0.. -> (n, horizon+1) log-point effect."""
    x = float(intensity_to_x(intensity, scale))
    R = horizon + 1
    effect = beta[:, :R] @ superposition_matrix(duration, horizon, x)
    if gamma is not None:
        ages = age0 + np.arange(duration)
        effect = effect + gamma[:, :R] @ superposition_matrix(duration, horizon, x * np.log1p(ages))
    return effect


def conflict_effect(betas: np.ndarray, duration: int, horizon: int, intensity: float) -> np.ndarray:
    """Constant per-year effect (no duration term)."""
    return own_effect(betas, None, duration, horizon, intensity)


def _band(a: np.ndarray) -> dict[str, list[float]]:
    q = np.percentile(a, QUANTILES, axis=0)
    return {key: q[i].tolist() for i, key in enumerate(Q_KEYS)}


def _quant(a: np.ndarray) -> dict[str, float]:
    q = np.percentile(a, QUANTILES)
    return {key: float(q[i]) for i, key in enumerate(Q_KEYS)}


def _nan_to_none(values: list[float]) -> list[float | None]:
    return [None if v is None or np.isnan(v) else float(v) for v in values]


class Simulator:
    def __init__(self, panel: Panel, artifacts: Artifacts, cfg: Config) -> None:
        self.panel = panel
        self.artifacts = artifacts
        self.cfg = cfg
        self.measure = cfg.conflict.measure
        self._arima: dict[tuple[str, int], ArimaFit | None] = {}

    def arima_fit(self, iso3: str, onset_year: int) -> ArimaFit | None:
        """Cached per (country, onset year): uses only data before the onset."""
        key = (iso3, onset_year)
        if key not in self._arima:
            s = self.panel.country(iso3)["lngdp"]
            sc = self.cfg.simulation
            self._arima[key] = fit_log_gdp(
                s[s.index < onset_year], sc.arima_min_obs, sc.arima_window
            )
        return self._arima[key]

    def simulate(
        self,
        iso3: str,
        onset_year: int,
        duration_years: int,
        intensity_per_100k: float,
        horizon: int = 10,
        n_sims: int = 10_000,
        seed: int | None = None,
        continue_existing_war: bool = False,
    ) -> tuple[dict[str, Any], list[Warn]]:
        if iso3 not in self.panel.countries:
            raise KeyError(iso3)
        if not 0 <= horizon <= self.cfg.simulation.max_horizon:
            raise ValueError(f"horizon must be in [0, {self.cfg.simulation.max_horizon}]")
        country = self.panel.country(iso3)
        base = build_baseline(country, onset_year, self.cfg)
        warns = list(base.warnings)
        p99 = self.artifacts.meta.get("intensity_p99_per_100k")
        if p99 is not None and intensity_per_100k > p99:
            warns.append(Warn.extrapolated_intensity(intensity_per_100k, p99))

        rng = np.random.default_rng(seed)
        R = horizon + 1
        years = onset_year + np.arange(R)
        steps = years - base.anchor_year  # >= 1
        n_steps = int(steps[-1])
        col = steps - 1

        def pick(outcome: str) -> dict[str, np.ndarray]:
            """Same bootstrap rows for every term of the measure."""
            terms = self.artifacts.response_terms(outcome, self.measure, horizon)
            rows = rng.integers(0, len(terms["shock"]), n_sims)
            return {t: a[rows] for t, a in terms.items()}

        # Already at war at onset? Then the simulated war continues it (diminishing damage).
        # Country already at war? By default the scenario is a NEW war of this size; with
        # continue_existing_war it extends the current one (smaller extra damage per year).
        age0 = 0
        if country["conflict"].get(onset_year - 1) == 1:
            if continue_existing_war:
                age0 = int(country["war_age"].get(onset_year - 1, 0)) + 1
                warns.append(Warn.already_at_war(onset_year - 1, age0 + 1))
            else:
                warns.append(Warn.currently_at_war(onset_year - 1))

        # --- GDP per capita (log points) ---
        gdp_terms = pick("gdp")
        shocks = rng.standard_normal((n_sims, n_steps))
        fit = None
        if self.cfg.simulation.baseline_method == "arima":
            fit = self.arima_fit(iso3, onset_year)
            if fit is None:
                warns.append(Warn.arima_fallback(self.cfg.simulation.arima_min_obs))
        if fit is not None and fit.anchor_year == base.anchor_year:
            base_ln = base.ln_gdp + np.cumsum(simulate_growth(fit, n_steps, shocks), axis=1)[:, col]
            method = fit.label
            growth, growth_sd = fit.drift, fit.sigma
        else:
            base_ln = (
                base.ln_gdp
                + base.growth * steps
                + np.cumsum(shocks * base.growth_sd, axis=1)[:, col]
            )
            method = "trend (mean peaceful growth + random walk)"
            growth, growth_sd = base.growth, base.growth_sd
        gdp_eff = own_effect(
            gdp_terms["shock"],
            gdp_terms.get("shock_age"),
            duration_years,
            horizon,
            intensity_per_100k,
            age0,
            self.cfg.conflict.intensity_scale,
        )
        scen_ln = base_ln + gdp_eff
        base_gdp, scen_gdp = np.exp(base_ln), np.exp(scen_ln)
        gdp_gap_pct = np.expm1(gdp_eff) * 100.0

        actual = country.reindex(years)
        result: dict[str, Any] = {
            "iso3": iso3,
            "onset_year": onset_year,
            "duration_years": duration_years,
            "intensity_per_100k": intensity_per_100k,
            "horizon": horizon,
            "n_sims": n_sims,
            "seed": seed,
            "measure": self.measure,
            "years": years.tolist(),
            "conflict_years": [int(onset_year + s) for s in range(duration_years) if s <= horizon],
            "gdp_pc": {
                "unit": "constant 2015 US$",
                "gap_unit": "% vs baseline",
                "baseline": _band(base_gdp),
                "scenario": _band(scen_gdp),
                "gap": _band(gdp_gap_pct),
                "actual": _nan_to_none(actual["gdp"].tolist()),
            },
        }
        headline: dict[str, Any] = {
            "year": int(years[-1]),
            "gdp_pc_gap_pct": _quant(gdp_gap_pct[:, -1]),
            "cumulative_gdp_pc_loss_usd": _quant((base_gdp - scen_gdp).sum(axis=1)),
            "fdi_gap_pp": None,
            "poverty_rate_gap_pp": None,
            "extra_people_in_poverty": None,
        }

        # --- FDI (% of GDP, 3-yr MA scale) ---
        if base.fdi_level is not None:
            fdi_noise = np.cumsum(rng.standard_normal((n_sims, n_steps)) * base.fdi_sd, axis=1)[
                :, col
            ]
            fdi_base = base.fdi_level + fdi_noise
            fdi_terms = pick("fdi")
            fdi_eff = own_effect(
                fdi_terms["shock"],
                fdi_terms.get("shock_age"),
                duration_years,
                horizon,
                intensity_per_100k,
                age0,
                self.cfg.conflict.intensity_scale,
            )
            result["fdi_pct_gdp"] = {
                "unit": "% of GDP (3-yr MA)",
                "gap_unit": "pp vs baseline",
                "baseline": _band(fdi_base),
                "scenario": _band(fdi_base + fdi_eff),
                "gap": _band(fdi_eff),
                "actual": _nan_to_none(actual["fdi"].tolist()),
            }
            headline["fdi_gap_pp"] = _quant(fdi_eff[:, -1])
        else:
            result["fdi_pct_gdp"] = None

        # --- Poverty via GDP elasticity ---
        if base.poverty_rate is not None and base.ln_gdp_at_poverty_year is not None:
            eta = rng.uniform(self.cfg.poverty.eta_low, self.cfg.poverty.eta_high, (n_sims, 1))
            ln_p0 = np.log(base.poverty_rate)
            pov_base = np.clip(
                np.exp(ln_p0 + eta * (base_ln - base.ln_gdp_at_poverty_year)), 0, 100
            )
            pov_scen = np.clip(
                np.exp(ln_p0 + eta * (scen_ln - base.ln_gdp_at_poverty_year)), 0, 100
            )
            pop = base.pop * np.exp(base.pop_growth * (years - base.pop_anchor_year))
            head_base, head_scen = pov_base / 100 * pop, pov_scen / 100 * pop
            result["poverty_rate"] = {
                "unit": "% of population",
                "gap_unit": "pp vs baseline",
                "baseline": _band(pov_base),
                "scenario": _band(pov_scen),
                "gap": _band(pov_scen - pov_base),
                "actual": _nan_to_none(actual["pov"].tolist()),
            }
            result["poverty_headcount"] = {
                "unit": "people",
                "gap_unit": "people vs baseline",
                "baseline": _band(head_base),
                "scenario": _band(head_scen),
                "gap": _band(head_scen - head_base),
                "actual": None,
            }
            headline["poverty_rate_gap_pp"] = _quant(pov_scen[:, -1] - pov_base[:, -1])
            headline["extra_people_in_poverty"] = _quant(head_scen[:, -1] - head_base[:, -1])
        else:
            result["poverty_rate"] = result["poverty_headcount"] = None

        result["neighbors"] = self._neighbors(
            iso3, gdp_terms.get("spill"), duration_years, horizon, intensity_per_100k
        )
        result["headline"] = headline
        result["baseline_assumptions"] = {
            "anchor_year": base.anchor_year,
            "gdp_growth_pct": growth * 100,
            "gdp_growth_sd_pct": growth_sd * 100,
            "method": method,
            "fdi_level_pct_gdp": base.fdi_level,
            "poverty_rate": base.poverty_rate,
            "poverty_year": base.poverty_year,
            "population": base.pop,
        }
        return result, warns

    def effect_draws(
        self, duration: int, horizon: int, intensity: float, n_sims: int, seed: int
    ) -> dict[str, np.ndarray]:
        """Per-draw GDP-pc terms for paired comparisons. The rng consumes draws in the same
        order as simulate(), so with the same seed the rows match simulate()'s draws:
        {'own': (n, horizon+1) log effect of a new war, 'spill_unit': delta rows (n, H)}."""
        rng = np.random.default_rng(seed)
        terms = self.artifacts.response_terms("gdp", self.measure, horizon)
        rows = rng.integers(0, len(terms["shock"]), n_sims)
        picked = {t: a[rows] for t, a in terms.items()}
        own = own_effect(
            picked["shock"],
            picked.get("shock_age"),
            duration,
            horizon,
            intensity,
            0,
            self.cfg.conflict.intensity_scale,
        )
        return {"own": own, "spill_unit": picked.get("spill")}

    def _neighbors(
        self,
        iso3: str,
        delta: np.ndarray | None,
        duration: int,
        horizon: int,
        intensity: float,
    ) -> list[dict[str, Any]]:
        """GDP-per-person effect on nearby countries: w_ji * x * sum_s delta[r - s]."""
        W = self.panel.weights
        D = self.panel.distances_km
        if delta is None or W is None or D is None or iso3 not in W.index:
            return []
        w = W[iso3]
        w = w[w > 0].sort_values(ascending=False).head(self.cfg.simulation.n_neighbors)
        unit = delta[:, : horizon + 1] @ superposition_matrix(
            duration, horizon, float(intensity_to_x(intensity, self.cfg.conflict.intensity_scale))
        )
        out = []
        for j, wj in w.items():
            gap = np.expm1(wj * unit) * 100.0
            out.append(
                {
                    "iso3": j,
                    "distance_km": float(D.loc[iso3, j]),
                    "weight": float(wj),
                    "gdp_pc_gap_pct": _quant(gap[:, -1]),
                    "gdp_pc_gap_pct_path": np.median(gap, axis=0).tolist(),
                }
            )
        return out
