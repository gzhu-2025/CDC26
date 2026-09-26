"""Country no-conflict baseline: trend extrapolation using only data before onset_year."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from conflict_sim.config import Config
from conflict_sim.warnings import Warn


@dataclass
class Baseline:
    anchor_year: int  # last year with GDP data before onset
    ln_gdp: float
    growth: float  # mean annual log growth, peaceful years
    growth_sd: float
    fdi_level: float | None
    fdi_sd: float
    pop_anchor_year: int
    pop: float
    pop_growth: float
    poverty_rate: float | None
    poverty_year: int | None
    ln_gdp_at_poverty_year: float | None
    warnings: list[Warn] = field(default_factory=list)


def _last_valid(s: pd.Series) -> tuple[int, float] | None:
    s = s.dropna()
    return (int(s.index[-1]), float(s.iloc[-1])) if len(s) else None


def build_baseline(country: pd.DataFrame, onset_year: int, cfg: Config) -> Baseline:
    """``country``: panel rows for one iso3, indexed by year."""
    sc = cfg.simulation
    warns: list[Warn] = []
    pre = country[country.index < onset_year]

    last_gdp = _last_valid(pre["lngdp"])
    if last_gdp is None:
        raise ValueError(f"no GDP per capita data before {onset_year}")
    anchor_year, ln_gdp = last_gdp
    n_gdp = int(pre["gdp"].notna().sum())
    if n_gdp < sc.min_gdp_years:
        warns.append(Warn.short_gdp(n_gdp, sc.min_gdp_years))
    if onset_year - 1 - anchor_year > 3:
        warns.append(Warn.stale_anchor(anchor_year, onset_year))

    dy = pre["dlngdp"]
    peaceful = dy[(pre["conflict"].fillna(0) == 0) & dy.notna()].tail(sc.baseline_window)
    if len(peaceful) < 3:
        peaceful = dy.dropna().tail(sc.baseline_window)
        warns.append(Warn.few_peaceful_years())
    all_growth = dy.dropna()
    growth = float(peaceful.mean()) if len(peaceful) else 0.0
    # volatility from the full history (not just the window) for a stable estimate
    growth_sd = float(all_growth.std()) if len(all_growth) > 2 else 0.03

    fdi_hist = pre["fdi_w"].dropna().tail(sc.fdi_baseline_window)
    fdi_level = float(fdi_hist.mean()) if len(fdi_hist) else None
    dfdi = pre["dfdi"].dropna()
    fdi_sd = float(dfdi.std()) if len(dfdi) > 2 else 1.0
    if fdi_level is None:
        warns.append(Warn.no_data("FDI"))

    pop_last = _last_valid(pre["pop"])
    if pop_last is None:
        raise ValueError(f"no population data before {onset_year}")
    pop_year, pop = pop_last
    lnpop = np.log(pre["pop"].dropna())
    pop_growth = float(lnpop.diff().dropna().tail(10).mean()) if len(lnpop) > 1 else 0.0

    pov = _last_valid(pre["pov"])
    pov_rate = pov_year = ln_gdp_pov = None
    if pov is None:
        warns.append(Warn.no_data("poverty"))
    else:
        pov_year, pov_rate = pov
        ln_gdp_pov = country["lngdp"].get(pov_year)
        if ln_gdp_pov is None or np.isnan(ln_gdp_pov):  # survey year without GDP: nearest
            s = pre["lngdp"].dropna()
            ln_gdp_pov = float(s.iloc[np.argmin(np.abs(s.index - pov_year))])
        if onset_year - pov_year > cfg.poverty.stale_after_years:
            warns.append(Warn.stale_poverty(pov_year))
        if pov_rate <= 0:
            pov_rate = 0.1
            warns.append(Warn.poverty_floor())

    return Baseline(
        anchor_year=anchor_year,
        ln_gdp=ln_gdp,
        growth=growth,
        growth_sd=growth_sd,
        fdi_level=fdi_level,
        fdi_sd=fdi_sd,
        pop_anchor_year=pop_year,
        pop=pop,
        pop_growth=pop_growth,
        poverty_rate=pov_rate,
        poverty_year=pov_year,
        ln_gdp_at_poverty_year=None if ln_gdp_pov is None else float(ln_gdp_pov),
        warnings=warns,
    )
