from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
import pytest

from conflict_sim.config import Config
from conflict_sim.estimation.__main__ import sanity_check
from conflict_sim.estimation.design import build_design
from conflict_sim.estimation.fe_solver import twoway_fe_ols
from conflict_sim.estimation.lp import estimate_path, fit_panelols
from conflict_sim.fixtures import TRUE_GDP_BETA, TRUE_GDP_GAMMA, generate
from conflict_sim.simulation.artifacts import Artifacts
from conflict_sim.simulation.simulator import own_effect
from conflict_sim.transforms import Panel, build_panel


def _rows_by_h(
    artifacts: Artifacts, outcome: str, key: str = "continuous"
) -> dict[int, dict[str, Any]]:
    return {r["h"]: r for r in artifacts.estimates[outcome][key]}


@pytest.mark.parametrize(
    ("outcome", "key", "truth_key"),
    [
        ("gdp", "continuous", "gdp"),
        ("fdi", "continuous", "fdi"),
        ("gdp", "continuous_spill", "gdp_spill"),
    ],
)
def test_recovers_injected_effect_within_ci(
    artifacts: Artifacts, truth: dict[str, Any], outcome: str, key: str, truth_key: str
) -> None:
    rows = _rows_by_h(artifacts, outcome, key)
    misses = [
        h
        for h, true_beta in zip(truth["horizons"], truth[truth_key], strict=True)
        if not rows[h]["ci_low"] <= true_beta <= rows[h]["ci_high"]
    ]
    # 95% CIs over 11 horizons: allow at most two misses
    assert len(misses) <= 2, f"{outcome}/{key}: truth outside CI at h={misses}"


@pytest.mark.parametrize("duration", [1, 5, 10])
def test_simulated_war_effect_matches_truth(
    artifacts: Artifacts, cfg: Config, duration: int
) -> None:
    """End to end: the war effect the simulator would apply (beta and gamma together, which
    are hard to separate individually in 40 countries) matches the injected one."""
    intensity = 50.0
    terms = artifacts.response_terms("gdp", "continuous", 10)
    sim = own_effect(
        terms["shock"],
        terms.get("shock_age"),
        duration,
        10,
        intensity,
        scale=cfg.conflict.intensity_scale,
    )
    true = own_effect(
        TRUE_GDP_BETA[None, :],
        TRUE_GDP_GAMMA[None, :],
        duration,
        10,
        intensity,
        scale=cfg.conflict.intensity_scale,
    )[0]
    lo, hi = np.percentile(sim, [2.5, 97.5], axis=0)
    inside = (lo <= true) & (true <= hi)
    assert inside.sum() >= 9, f"duration={duration}: outside at r={np.flatnonzero(~inside)}"


def test_gdp_war_effect_detected(artifacts: Artifacts, cfg: Config) -> None:
    """A 5-year war is clearly harmful once beta and gamma are combined: the median effect
    is negative at every horizon and most bootstrap draws agree (40 countries is a small
    sample, so the tails of a cluster bootstrap are wide)."""
    terms = artifacts.response_terms("gdp", "continuous", 10)
    eff = own_effect(
        terms["shock"], terms.get("shock_age"), 5, 10, 50.0, scale=cfg.conflict.intensity_scale
    )
    assert np.median(eff, axis=0).max() < 0
    assert (eff[:, 5] < 0).mean() > 0.75


def test_no_pretrend_on_clean_fixture(artifacts: Artifacts) -> None:
    leads = [r for r in artifacts.estimates["gdp"]["continuous"] if r["is_lead"]]
    assert [r["h"] for r in leads] == [-3, -2, -1]
    assert all(r["p_value"] > 0.05 for r in leads)


def test_anticipation_is_flagged(cfg: Config) -> None:
    long, _ = generate(seed=7, anticipation=-0.05)
    rows = estimate_path(build_panel(long, cfg), cfg, "gdp", "continuous")
    assert any(r["is_lead"] and r["p_value"] < 0.05 for r in rows)


def test_leads_are_not_degenerate(panel: Panel, cfg: Config) -> None:
    for h in (-3, -2, -1):
        d = build_design(panel, cfg, "gdp", "continuous", h)
        assert np.std(d.dep) > 0


@pytest.mark.parametrize(
    ("outcome", "measure", "h"),
    [("gdp", "continuous", 4), ("fdi", "onset", 2), ("gdp", "continuous", -2)],
)
def test_fast_solver_matches_panelols(
    panel: Panel, cfg: Config, outcome: str, measure: str, h: int
) -> None:
    d = build_design(panel, cfg, outcome, measure, h)
    entity, time = pd.factorize(d.iso3)[0], pd.factorize(d.year, sort=True)[0]
    fast = twoway_fe_ols(d.dep, d.exog, entity, time)
    assert fast[0] == pytest.approx(fit_panelols(d)["beta"], abs=1e-8)


def test_bootstrap_artifact_shape(artifacts: Artifacts, cfg: Config) -> None:
    from tests.conftest import TEST_DRAWS

    for outcome in ("gdp", "fdi"):
        for m in ("continuous", "onset"):
            arr = artifacts.draws[outcome][m]
            assert arr.shape[1] == len(cfg.lp.horizons)
            assert arr.shape[0] >= 0.95 * TEST_DRAWS


def test_bootstrap_ci_close_to_analytic(artifacts: Artifacts) -> None:
    """Same order of magnitude. With ~40 controls and only 40 fixture countries, resamples
    with few war countries are unstable, so bootstrap CIs run up to ~3x wider at long h."""
    for r in artifacts.estimates["gdp"]["continuous"]:
        boot_width = r["boot_ci_high"] - r["boot_ci_low"]
        analytic_width = r["ci_high"] - r["ci_low"]
        assert 0.4 < boot_width / analytic_width < 3.0


def test_sanity_check_logs_but_never_fails(
    artifacts: Artifacts, cfg: Config, caplog: pytest.LogCaptureFixture
) -> None:
    draws = artifacts.draws["gdp"]["continuous"]
    with caplog.at_level(logging.WARNING):
        ok = sanity_check(
            draws, artifacts.horizons, cfg, artifacts.draws["gdp"].get("continuous_shock_age")
        )
        bad = sanity_check(draws * 20, artifacts.horizons, cfg)
    assert ok["within_band"]  # fixture is calibrated to ~ -11% at h=5
    assert not bad["within_band"]
    assert "SANITY" in caplog.text


def test_spatial_weights_decay_with_distance(panel: Panel) -> None:
    assert panel.has_spatial
    w, d = panel.weights, panel.distances_km
    assert (w.to_numpy().diagonal() == 0).all()
    # Uganda-Kenya (~500 km) weighs far more than Uganda-Mexico (~14,000 km, zeroed)
    assert w.loc["UGA", "KEN"] > 0.3 > w.loc["UGA", "MEX"] == 0.0
    assert d.loc["UGA", "KEN"] < 1000


def test_design_has_key_terms(panel: Panel, cfg: Config) -> None:
    d = build_design(panel, cfg, "gdp", "continuous", 3)
    assert d.key_terms == ("shock", "shock_age", "spill")
    assert d.names[:3] == ["shock", "shock_age", "spill"]
    assert build_design(panel, cfg, "gdp", "onset", 3).key_terms == ("shock",)
