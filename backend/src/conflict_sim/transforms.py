"""Long indicators -> balanced wide country-year panel with model variables."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from conflict_sim.config import Config
from conflict_sim.contracts import DEATHS, FDI, GDP, POP, POV


@dataclass(frozen=True)
class Panel:
    df: pd.DataFrame  # MultiIndex (iso3, year), full grid, sorted
    deaths_first_year: int | None
    fdi_winsor_bounds: tuple[float, float]
    # Spatial weights w_ij = exp(-distance_ij / kernel_km), zero diagonal; rows: iso3 i,
    # columns: iso3 j. None when coordinates are unavailable.
    weights: pd.DataFrame | None = None
    distances_km: pd.DataFrame | None = None

    @property
    def has_spatial(self) -> bool:
        return self.weights is not None

    def country(self, iso3: str) -> pd.DataFrame:
        return self.df.xs(iso3, level="iso3")

    @property
    def countries(self) -> list[str]:
        return list(self.df.index.get_level_values("iso3").unique())


def _shift(s: pd.Series, k: int) -> pd.Series:
    """Within-country shift on the full grid: _shift(s, 1)[t] = s[t-1]."""
    return s.groupby(level="iso3").shift(k)


def intensity_to_x(deaths_per_100k: Any, scale: float = 1.0) -> Any:
    """Continuous conflict measure x = log1p(deaths per 100k / scale). A larger scale makes
    low-intensity violence count for less relative to major wars."""
    return np.log1p(deaths_per_100k / scale)


def haversine_km(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Pairwise great-circle distances between capitals (km)."""
    la, lo = np.radians(lat)[:, None], np.radians(lon)[:, None]
    a = np.sin((la - la.T) / 2) ** 2 + np.cos(la) * np.cos(la.T) * np.sin((lo - lo.T) / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def spatial_weights(
    countries: pd.DataFrame | None, iso: list[str], cfg: Config
) -> tuple[pd.DataFrame, pd.DataFrame] | None:
    """Distance-decay weights between capitals; a small kernel means only close neighbors
    matter. Pairs below ``min_weight`` are zeroed."""
    if not cfg.spatial.enabled or countries is None:
        return None
    if not {"latitude", "longitude"} <= set(countries.columns):
        return None
    coords = countries.reindex(iso)[["latitude", "longitude"]].astype(float)
    known = coords.dropna().index.tolist()
    if len(known) < 2:
        return None
    d = haversine_km(
        coords.loc[known, "latitude"].to_numpy(), coords.loc[known, "longitude"].to_numpy()
    )
    w = np.exp(-d / cfg.spatial.kernel_km)
    np.fill_diagonal(w, 0.0)
    w[w < cfg.spatial.min_weight] = 0.0
    return pd.DataFrame(w, known, known), pd.DataFrame(d, known, known)


def _war_age(conflict: pd.Series, merge_gap: int) -> pd.Series:
    """Years since the current episode began (0 in its first year, 0 outside wars). Lulls of
    up to ``merge_gap`` peaceful years do not end an episode."""
    out = pd.Series(0.0, index=conflict.index)
    for iso3, s in conflict.groupby(level="iso3"):
        start: int | None = None
        last_war: int | None = None
        vals = []
        for (_, year), c in s.items():
            if c == 1:
                if start is None or last_war is None or year - last_war > merge_gap + 1:
                    start = year
                last_war = year
                vals.append(year - start)
            else:
                vals.append(0)
        out.loc[iso3] = vals
    return out


def conflict_episodes(panel: Panel, merge_gap: int) -> pd.DataFrame:
    """One row per conflict episode: iso3, start, end, duration, mean and peak deaths/100k.
    Lulls of up to ``merge_gap`` peaceful years are merged into the surrounding episode."""
    rows = []
    for iso3, d in panel.df.groupby(level="iso3"):
        d = d.droplevel("iso3")
        war_years = d.index[d["conflict"] == 1].tolist()
        if not war_years:
            continue
        groups = [[war_years[0]]]
        for y in war_years[1:]:
            if y - groups[-1][-1] <= merge_gap + 1:
                groups[-1].append(y)
            else:
                groups.append([y])
        for g in groups:
            span = d.loc[g[0] : g[-1], "deaths_per_100k"].fillna(0.0)
            rows.append(
                {
                    "iso3": iso3,
                    "start": g[0],
                    "end": g[-1],
                    "duration": g[-1] - g[0] + 1,
                    "intensity": float(span.mean()),
                    "peak": float(span.max()),
                }
            )
    return pd.DataFrame(rows, columns=["iso3", "start", "end", "duration", "intensity", "peak"])


def build_panel(long: pd.DataFrame, cfg: Config, countries: pd.DataFrame | None = None) -> Panel:
    wide = long.pivot_table(
        index=["iso3", "year"], columns="indicator", values="value", aggfunc="first", dropna=False
    )
    for code in (DEATHS, POP, GDP, FDI, POV):
        if code not in wide:
            wide[code] = np.nan
    iso = wide.index.get_level_values("iso3").unique()
    years = range(int(long["year"].min()), int(long["year"].max()) + 1)
    grid = pd.MultiIndex.from_product([sorted(iso), years], names=["iso3", "year"])
    wide = wide.reindex(grid)

    df = pd.DataFrame(index=grid)
    df["pop"] = wide[POP]
    df["gdp"] = wide[GDP]
    df["fdi_raw"] = wide[FDI]
    df["pov"] = wide[POV]

    deaths = wide[DEATHS].copy()
    observed_years = deaths.dropna().index.get_level_values("year")
    first = int(observed_years.min()) if len(observed_years) else None
    if cfg.conflict.missing_deaths_as_zero and first is not None:
        in_coverage = df.index.get_level_values("year") >= first
        deaths[in_coverage] = deaths[in_coverage].fillna(0.0)
    df["deaths"] = deaths
    df["deaths_per_100k"] = deaths / df["pop"] * 1e5
    df["x"] = intensity_to_x(df["deaths_per_100k"], cfg.conflict.intensity_scale)

    conflict = (deaths >= cfg.conflict.onset_threshold).astype(float).where(deaths.notna())
    df["conflict"] = conflict
    peaceful_before = pd.Series(1.0, index=grid)
    for k in range(1, cfg.conflict.onset_peace_years + 1):
        peaceful_before = peaceful_before * (1.0 - _shift(conflict, k))  # NaN if unknown
    df["onset"] = conflict * peaceful_before
    df["war_age"] = _war_age(conflict, cfg.conflict.merge_gap_years)
    # Diminishing damage in long wars: interaction x * log1p(years into the war)
    df["x_age"] = df["x"] * np.log1p(df["war_age"])

    sw = spatial_weights(countries, sorted(iso), cfg)
    weights, dist = sw if sw else (None, None)
    if weights is not None:
        x_wide = df["x"].unstack("year").reindex(weights.index).fillna(0.0)
        spill = pd.DataFrame(weights.to_numpy() @ x_wide.to_numpy(), weights.index, x_wide.columns)
        df["spill"] = spill.stack().reindex(grid)  # NaN for countries without coordinates
        df.loc[df["x"].isna(), "spill"] = np.nan
    else:
        df["spill"] = np.nan

    df["lngdp"] = np.log(df["gdp"].where(df["gdp"] > 0))
    df["dlngdp"] = df["lngdp"] - _shift(df["lngdp"], 1)

    # FDI: winsorize pooled over the estimation sample, then trailing moving average.
    in_sample = _sample_mask(df, cfg)
    lo_q, hi_q = cfg.fdi.winsor
    ref = df.loc[in_sample, "fdi_raw"].dropna()
    lo, hi = (
        (float(ref.quantile(lo_q)), float(ref.quantile(hi_q))) if len(ref) else (-np.inf, np.inf)
    )
    df["fdi_w"] = df["fdi_raw"].clip(lo, hi)
    w = cfg.fdi.ma_window
    df["fdi"] = df.groupby(level="iso3")["fdi_w"].transform(
        lambda s: s.rolling(w, min_periods=max(1, w - 1)).mean()
    )
    df["dfdi"] = df["fdi"] - _shift(df["fdi"], 1)
    return Panel(
        df=df,
        deaths_first_year=first,
        fdi_winsor_bounds=(lo, hi),
        weights=weights,
        distances_km=dist,
    )


def _sample_mask(df: pd.DataFrame, cfg: Config) -> pd.Series:
    years = df.index.get_level_values("year")
    big = df.groupby(level="iso3")["pop"].transform("median") >= cfg.sample.min_population
    return pd.Series(
        (years >= cfg.sample.start_year) & (years <= cfg.sample.end_year) & big.to_numpy(),
        index=df.index,
    )


def sample_mask(panel: Panel, cfg: Config) -> pd.Series:
    """Rows eligible as shock year t in the estimation sample."""
    return _sample_mask(panel.df, cfg)
