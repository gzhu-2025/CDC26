from __future__ import annotations

import time
from typing import Any

import numpy as np
import pytest

from conflict_sim.simulation.simulator import Q_KEYS, Simulator, superposition_matrix

ARGS = {"iso3": "KEN", "onset_year": 2024, "duration_years": 5, "intensity_per_100k": 20.0}


def _bands(result: dict[str, Any]) -> list[dict[str, list[float]]]:
    out = []
    for key in ("gdp_pc", "fdi_pct_gdp", "poverty_rate", "poverty_headcount"):
        if result[key]:
            out += [result[key][b] for b in ("baseline", "scenario", "gap")]
    return out


def test_quantiles_monotonic(simulator: Simulator) -> None:
    result, _ = simulator.simulate(**ARGS, seed=1)
    for band in _bands(result):
        q = np.array([band[k] for k in Q_KEYS])
        assert np.all(np.diff(q, axis=0) >= -1e-9)
    for q in result["headline"].values():
        if isinstance(q, dict):
            assert list(q.values()) == sorted(q.values())


def test_poverty_rate_bounded(simulator: Simulator) -> None:
    for iso3 in simulator.panel.countries[:15]:
        try:
            result, _ = simulator.simulate(iso3, 2020, 8, 500.0, seed=3, n_sims=2000)
        except ValueError:
            continue
        if result["poverty_rate"]:
            for part in ("baseline", "scenario"):
                vals = np.array([result["poverty_rate"][part][k] for k in Q_KEYS])
                assert vals.min() >= 0 and vals.max() <= 100


def test_same_seed_same_output(simulator: Simulator) -> None:
    a, _ = simulator.simulate(**ARGS, seed=42)
    b, _ = simulator.simulate(**ARGS, seed=42)
    c, _ = simulator.simulate(**ARGS, seed=43)
    assert a == b
    assert a != c


def test_10k_sims_under_one_second(simulator: Simulator) -> None:
    simulator.simulate(**ARGS, seed=0)  # warm-up
    t0 = time.perf_counter()
    simulator.simulate(**ARGS, n_sims=10_000, seed=0)
    assert time.perf_counter() - t0 < 1.0


def test_zero_intensity_zero_gap(simulator: Simulator) -> None:
    result, _ = simulator.simulate(**{**ARGS, "intensity_per_100k": 0.0}, seed=5)
    assert np.allclose(result["gdp_pc"]["gap"]["p50"], 0)
    assert np.allclose(result["gdp_pc"]["baseline"]["p50"], result["gdp_pc"]["scenario"]["p50"])


def test_gdp_gap_negative_and_grows_with_intensity(simulator: Simulator) -> None:
    low, _ = simulator.simulate(**{**ARGS, "intensity_per_100k": 2.0}, seed=5)
    high, _ = simulator.simulate(**{**ARGS, "intensity_per_100k": 100.0}, seed=5)
    assert high["headline"]["gdp_pc_gap_pct"]["p50"] < low["headline"]["gdp_pc_gap_pct"]["p50"] < 0


def test_superposition_matrix() -> None:
    C = superposition_matrix(duration=2, horizon=3, x=1.0)
    # effect[r] = beta[r] + beta[r-1]
    assert C.tolist() == [[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 1], [0, 0, 0, 1]]


def test_short_history_warning(simulator: Simulator) -> None:
    _, warns = simulator.simulate("LBR", 2024, 3, 10.0, seed=0, n_sims=500)
    assert "SHORT_GDP_HISTORY" in {w.code for w in warns}


def test_unknown_country(simulator: Simulator) -> None:
    with pytest.raises(KeyError):
        simulator.simulate("ZZZ", 2024, 3, 10.0)


def test_historical_onset_includes_actuals(simulator: Simulator) -> None:
    result, _ = simulator.simulate("KEN", 2010, 3, 10.0, seed=0, n_sims=500)
    assert any(v is not None for v in result["gdp_pc"]["actual"])
    assert result["baseline_assumptions"]["anchor_year"] <= 2009


def test_neighbors_get_spillover(simulator: Simulator) -> None:
    result, _ = simulator.simulate("UGA", 2024, 5, 50.0, seed=1, n_sims=2000)
    nb = result["neighbors"]
    assert nb, "Uganda has neighbors within the kernel"
    weights = [n["weight"] for n in nb]
    assert weights == sorted(weights, reverse=True)
    assert all(n["distance_km"] < 3000 for n in nb)
    # closer neighbors are hit at least as hard (same delta, larger weight)
    gaps = [abs(n["gdp_pc_gap_pct"]["p50"]) for n in nb]
    assert gaps == sorted(gaps, reverse=True)


def test_already_at_war_new_vs_continued(simulator: Simulator) -> None:
    panel = simulator.panel.df
    at_war = panel[(panel["conflict"] == 1) & (panel["war_age"] >= 2)]
    iso3, year = at_war.index[0]
    args = (iso3, int(year) + 1, 3, 10.0)
    new, w_new = simulator.simulate(*args, seed=0, n_sims=500)
    cont, w_cont = simulator.simulate(*args, seed=0, n_sims=500, continue_existing_war=True)
    assert "CURRENTLY_AT_WAR" in {w.code for w in w_new}
    assert "ALREADY_AT_WAR" in {w.code for w in w_cont}
    assert new["headline"]["gdp_pc_gap_pct"] != cont["headline"]["gdp_pc_gap_pct"]
