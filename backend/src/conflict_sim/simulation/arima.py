"""ARIMA(p,1,q)-with-drift baseline for log GDP per capita (the "no-war path").

For each country, fit a small grid of orders on the last contiguous run of pre-onset data
and keep the lowest AIC. Paths are simulated with our own vectorized recursion (all sims
at once, a loop over forecast years only) so the simulator's random draws stay shared
between the baseline and the war scenario. Parameter uncertainty is not propagated.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

ORDERS: tuple[tuple[int, int, int], ...] = ((0, 1, 0), (1, 1, 0), (0, 1, 1), (1, 1, 1), (2, 1, 0))


@dataclass(frozen=True)
class ArimaFit:
    order: tuple[int, int, int]
    aic: float
    drift: float  # mean annual log growth
    ar: np.ndarray  # phi_1..phi_p
    ma: np.ndarray  # theta_1..theta_q
    sigma: float
    last_dev: np.ndarray  # last p values of (dy - drift), most recent last
    last_eps: np.ndarray  # last q innovations, most recent last
    start_year: int
    anchor_year: int

    @property
    def label(self) -> str:
        p, d, q = self.order
        return f"ARIMA({p},{d},{q}) with drift"


def _last_contiguous(s: pd.Series) -> pd.Series:
    """Longest run of consecutive non-null years ending at the last valid year."""
    s = s.dropna()
    if s.empty:
        return s
    years = s.index.to_numpy()
    breaks = np.flatnonzero(np.diff(years) != 1)
    start = breaks[-1] + 1 if len(breaks) else 0
    return s.iloc[start:]


def fit_log_gdp(lngdp: pd.Series, min_obs: int = 15, window: int = 30) -> ArimaFit | None:
    """Fit on pre-onset log GDP pc (index = year). None if too little contiguous data."""
    s = _last_contiguous(lngdp).tail(window)
    if len(s) < min_obs:
        return None
    y = s.to_numpy(float)
    best = None
    for order in ORDERS:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = ARIMA(y, order=order, trend="t").fit()
        except (ValueError, np.linalg.LinAlgError):
            continue
        if np.isfinite(res.aic) and (best is None or res.aic < best[1].aic):
            best = (order, res)
    if best is None:
        return None
    order, res = best
    names = list(res.model.param_names)
    params = dict(zip(names, np.asarray(res.params), strict=True))
    p, _, q = order
    drift = float(params["x1"])
    ar = np.array([params[f"ar.L{i}"] for i in range(1, p + 1)])
    ma = np.array([params[f"ma.L{i}"] for i in range(1, q + 1)])
    dev = np.diff(y) - drift
    eps = np.asarray(res.resid)[1:]  # first residual is the (diffuse) initial level
    return ArimaFit(
        order=order,
        aic=float(res.aic),
        drift=drift,
        ar=ar,
        ma=ma,
        sigma=float(np.sqrt(params["sigma2"])),
        last_dev=dev[-p:] if p else np.zeros(0),
        last_eps=eps[-q:] if q else np.zeros(0),
        start_year=int(s.index[0]),
        anchor_year=int(s.index[-1]),
    )


def simulate_growth(fit: ArimaFit, n_steps: int, shocks: np.ndarray) -> np.ndarray:
    """Annual log-growth paths (n_sims, n_steps) from standard-normal ``shocks``."""
    n_sims = shocks.shape[0]
    p, q = len(fit.ar), len(fit.ma)
    dev_hist = np.tile(fit.last_dev, (n_sims, 1))  # (n, p)
    eps_hist = np.tile(fit.last_eps, (n_sims, 1))  # (n, q)
    out = np.empty((n_sims, n_steps))
    for t in range(n_steps):
        eps = shocks[:, t] * fit.sigma
        dev = eps.copy()
        if p:
            dev += dev_hist[:, ::-1] @ fit.ar  # phi_1 * dev[t-1] + ...
        if q:
            dev += eps_hist[:, ::-1] @ fit.ma
        out[:, t] = fit.drift + dev
        if p:
            dev_hist = np.column_stack([dev_hist[:, 1:], dev])
        if q:
            eps_hist = np.column_stack([eps_hist[:, 1:], eps])
    return out
