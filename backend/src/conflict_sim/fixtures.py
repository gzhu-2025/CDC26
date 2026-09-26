"""Synthetic Contract-1 fixture with KNOWN conflict effects (ground truth for tests).

Data-generating process (per country i, year t), with x = log1p(deaths per 100k / scale):
    ln GDP[t] = a_i + g_i t + global_t + AR(1) noise
                + sum_s (B[t-s] + G[t-s] * log1p(war_age[s])) * x[s]     own war
                + sum_s D[t-s] * spill[s]                                 neighbors' wars
    FDI[t]    = f_i + AR(1) noise + sum_s F[t-s] x[s]
    poverty   = P0_i * exp(eta_true * (ln GDP[t] - ln GDP[t0]))   (sparse surveys)
spill[s] = sum_j w_ij x_j[s] with the same distance kernel as config.yaml. B, G and D are
per-year impulse responses held at their h=10 value afterwards (permanent level effects);
F decays to 0. The FDI LP outcome is a 3-yr trailing MA, so its truth is the MA of F.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from conflict_sim.config import Config, default_config
from conflict_sim.transforms import haversine_km

H = np.arange(11)
TRUE_GDP_BETA = -0.03 * (1 - np.exp(-(H + 1) / 1.5))  # log points per unit x
TRUE_GDP_GAMMA = 0.008 * (1 - np.exp(-(H + 1) / 1.5))  # later war years hurt less
TRUE_GDP_DELTA = -0.012 * (1 - np.exp(-(H + 1) / 3.0))  # per unit neighbor exposure
TRUE_FDI_BETA = -0.25 * np.exp(-H / 4.0)  # pp of GDP per unit x
ETA_TRUE = -2.0

# name, capital latitude, capital longitude
COUNTRIES: dict[str, tuple[str, float, float]] = {
    "AFG": ("Afghanistan", 34.5, 69.2),
    "AGO": ("Angola", -8.8, 13.2),
    "BDI": ("Burundi", -3.4, 29.4),
    "BEN": ("Benin", 6.5, 2.6),
    "BFA": ("Burkina Faso", 12.4, -1.5),
    "BGD": ("Bangladesh", 23.8, 90.4),
    "BOL": ("Bolivia", -16.5, -68.1),
    "BRA": ("Brazil", -15.8, -47.9),
    "CAF": ("Central African Republic", 4.4, 18.6),
    "CHL": ("Chile", -33.4, -70.6),
    "CIV": ("Cote d'Ivoire", 6.8, -5.3),
    "CMR": ("Cameroon", 3.9, 11.5),
    "COD": ("Congo, Dem. Rep.", -4.3, 15.3),
    "COL": ("Colombia", 4.7, -74.1),
    "EGY": ("Egypt", 30.0, 31.2),
    "ETH": ("Ethiopia", 9.0, 38.7),
    "GHA": ("Ghana", 5.6, -0.2),
    "GTM": ("Guatemala", 14.6, -90.5),
    "IDN": ("Indonesia", -6.2, 106.8),
    "IND": ("India", 28.6, 77.2),
    "IRQ": ("Iraq", 33.3, 44.4),
    "KEN": ("Kenya", -1.3, 36.8),
    "LBR": ("Liberia", 6.3, -10.8),
    "LKA": ("Sri Lanka", 6.9, 79.9),
    "MAR": ("Morocco", 34.0, -6.8),
    "MEX": ("Mexico", 19.4, -99.1),
    "MLI": ("Mali", 12.6, -8.0),
    "MOZ": ("Mozambique", -25.9, 32.6),
    "NER": ("Niger", 13.5, 2.1),
    "NGA": ("Nigeria", 9.1, 7.5),
    "NPL": ("Nepal", 27.7, 85.3),
    "PAK": ("Pakistan", 33.7, 73.1),
    "PER": ("Peru", -12.0, -77.0),
    "PHL": ("Philippines", 14.6, 121.0),
    "SDN": ("Sudan", 15.6, 32.5),
    "SLE": ("Sierra Leone", 8.5, -13.2),
    "SYR": ("Syria", 33.5, 36.3),
    "TZA": ("Tanzania", -6.2, 35.7),
    "UGA": ("Uganda", 0.3, 32.6),
    "VNM": ("Vietnam", 21.0, 105.8),
}


def _ma(a: np.ndarray, w: int) -> np.ndarray:
    """Trailing MA of an impulse response; pre-shock periods contribute 0."""
    padded = np.concatenate([np.zeros(w - 1), a])
    return np.array([padded[k : k + w].mean() for k in range(len(a))])


def truth(ma_window: int = 3) -> dict[str, list[float]]:
    return {
        "horizons": H.tolist(),
        "gdp": TRUE_GDP_BETA.tolist(),
        "gdp_shock_age": TRUE_GDP_GAMMA.tolist(),
        "gdp_spill": TRUE_GDP_DELTA.tolist(),
        "fdi": _ma(TRUE_FDI_BETA, ma_window).tolist(),
        "eta": [ETA_TRUE],
    }


def country_meta() -> pd.DataFrame:
    return pd.DataFrame(
        [(iso, n, lat, lon) for iso, (n, lat, lon) in COUNTRIES.items()],
        columns=["iso3", "name", "latitude", "longitude"],
    )


def _war_age(conflict: np.ndarray, merge_gap: int) -> np.ndarray:
    age = np.zeros(len(conflict))
    start = last = None
    for t, c in enumerate(conflict):
        if c:
            if start is None or last is None or t - last > merge_gap + 1:
                start = t
            last = t
            age[t] = t - start
    return age


def _superpose(path: np.ndarray, x: np.ndarray) -> np.ndarray:
    """out[t] = sum_{s<=t} path[t-s] x[s], path held at its last value beyond h=10."""
    T = len(x)
    full = np.concatenate([path, np.full(T, path[-1])])
    return np.array([np.dot(full[t - np.arange(t + 1)], x[: t + 1]) for t in range(T)])


def generate(
    seed: int = 7,
    start: int = 1990,
    end: int = 2023,
    anticipation: float = 0.0,
    cfg: Config | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (long indicators, episodes). ``anticipation`` adds a GDP drop per unit x of the
    upcoming episode in the 2 years BEFORE onset (used to test the pre-trend warning)."""
    cfg = cfg or default_config()
    scale = cfg.conflict.intensity_scale
    rng = np.random.default_rng(seed)
    years = np.arange(start, end + 1)
    T = len(years)
    global_shock = rng.normal(0, 0.015, T)
    iso_list = list(COUNTRIES)
    at_war = set(rng.choice(iso_list, size=24, replace=False))

    # Pass 1: conflict histories
    pops, deaths_all, xs, episodes = {}, {}, {}, []
    for iso in iso_list:
        pop = rng.uniform(2e6, 1.2e8) * np.exp(rng.uniform(0.01, 0.03) * np.arange(T))
        deaths = np.full(T, np.nan)  # null = no recorded battle deaths (as in WB data)
        if iso in at_war:
            n_ep = rng.integers(1, 3)
            cursor = rng.integers(3, 10)
            for _ in range(n_ep):
                dur = int(rng.integers(1, 9))
                if cursor + dur >= T - 2:
                    break
                level = float(rng.lognormal(np.log(8), 1.1))  # deaths per 100k
                for k in range(dur):
                    dp = level * rng.lognormal(0, 0.4)
                    deaths[cursor + k] = max(25.0, dp * pop[cursor + k] / 1e5)
                episodes.append(
                    {"iso3": iso, "start": int(years[cursor]), "duration": dur, "level": level}
                )
                cursor += dur + int(rng.integers(4, 12))
        minor = (rng.random(T) < 0.05) & np.isnan(deaths)  # sporadic violence below threshold
        deaths[minor] = rng.integers(1, 25, minor.sum())
        pops[iso], deaths_all[iso] = pop, deaths
        xs[iso] = np.log1p(np.nan_to_num(deaths) / pop * 1e5 / scale)

    # Neighbor exposure, same kernel as the estimator
    meta = country_meta().set_index("iso3")
    d = haversine_km(meta["latitude"].to_numpy(), meta["longitude"].to_numpy())
    W = np.exp(-d / cfg.spatial.kernel_km)
    np.fill_diagonal(W, 0.0)
    W[cfg.spatial.min_weight > W] = 0.0
    X = np.vstack([xs[iso] for iso in iso_list])
    spill = W @ X

    # Pass 2: outcomes
    rows: list[pd.DataFrame] = []
    for i, iso in enumerate(iso_list):
        x, deaths, pop = xs[iso], deaths_all[iso], pops[iso]
        conflict = np.nan_to_num(deaths) >= cfg.conflict.onset_threshold
        age_term = x * np.log1p(_war_age(conflict, cfg.conflict.merge_gap_years))
        gdp_eff = (
            _superpose(TRUE_GDP_BETA, x)
            + _superpose(TRUE_GDP_GAMMA, age_term)
            + _superpose(TRUE_GDP_DELTA, spill[i])
        )
        F_full = np.concatenate([TRUE_FDI_BETA, np.zeros(T)])
        fdi_eff = np.array([sum(F_full[t - s] * x[s] for s in range(t + 1)) for t in range(T)])
        if anticipation:
            onset = (x > 0) & (np.concatenate([[0.0], x[:-1]]) == 0) & conflict
            for t in np.flatnonzero(onset):
                for lag in (1, 2):
                    if t - lag >= 0:
                        gdp_eff[t - lag :] += anticipation * x[t] / 2

        growth_noise = np.zeros(T)
        e = rng.normal(0, 0.02, T)
        for t in range(1, T):
            growth_noise[t] = 0.3 * growth_noise[t - 1] + e[t]
        g = rng.normal(0.02, 0.012)
        lngdp = (
            np.log(rng.uniform(400, 15000))
            + g * np.arange(T)
            + np.cumsum(global_shock + growth_noise)
            + gdp_eff
        )
        fdi_noise = np.zeros(T)
        u = rng.normal(0, 1.2, T)
        for t in range(1, T):
            fdi_noise[t] = 0.5 * fdi_noise[t - 1] + u[t]
        fdi = rng.normal(3, 1.5) + fdi_noise + fdi_eff
        fdi[rng.random(T) < 0.01] *= 8  # rare outliers, handled by winsorizing

        p0 = rng.uniform(1, 60)
        pov = np.clip(p0 * np.exp(ETA_TRUE * (lngdp - lngdp[0])), 0, 100)
        survey = np.zeros(T, bool)
        t = int(rng.integers(0, 5))
        while t < T:
            survey[t] = True
            t += int(rng.integers(3, 7))

        # Missingness concentrated in conflict years
        gdp_miss = rng.random(T) < np.where(conflict, 0.25, 0.02)
        fdi_miss = rng.random(T) < np.where(conflict, 0.35, 0.05)
        pov_miss = ~survey | (conflict & (rng.random(T) < 0.7))
        gdp_vals = np.where(gdp_miss, np.nan, np.exp(lngdp))
        if iso in ("LBR", "CAF"):  # short GDP history -> warning path
            gdp_vals[: T - 8] = np.nan

        for code, vals in (
            ("VC.BTL.DETH", deaths),
            ("SP.POP.TOTL", np.round(pop)),
            ("NY.GDP.PCAP.KD", gdp_vals),
            ("BX.KLT.DINV.WD.GD.ZS", np.where(fdi_miss, np.nan, fdi)),
            ("SI.POV.DDAY", np.where(pov_miss, np.nan, pov)),
        ):
            rows.append(
                pd.DataFrame({"iso3": iso, "year": years, "indicator": code, "value": vals})
            )

    long = pd.concat(rows, ignore_index=True)
    long["value"] = long["value"].astype(float)
    return long, pd.DataFrame(episodes)


def write_fixture(out_dir: Path, seed: int = 7) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    long, episodes = generate(seed=seed)
    path = out_dir / "indicators_sample.parquet"
    long.to_parquet(path, index=False)
    country_meta().to_parquet(out_dir / "countries_sample.parquet", index=False)
    (out_dir / "truth.json").write_text(
        json.dumps({**truth(), "episodes": episodes.to_dict("records"), "seed": seed}, indent=2)
    )
    return path


if __name__ == "__main__":
    print(write_fixture(Path(__file__).resolve().parents[2] / "tests" / "fixtures"))
