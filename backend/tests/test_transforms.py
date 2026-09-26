from __future__ import annotations

import numpy as np
import pandas as pd

from conflict_sim.config import Config, FDICfg
from conflict_sim.transforms import Panel, build_panel


def _long(deaths: list[float | None], start: int = 1989) -> pd.DataFrame:
    years = list(range(start, start + len(deaths)))
    n = len(years)
    rows = {
        "VC.BTL.DETH": deaths,
        "SP.POP.TOTL": [1e7] * n,
        "NY.GDP.PCAP.KD": [1000.0 * 1.02**k for k in range(n)],
        "BX.KLT.DINV.WD.GD.ZS": [float(k) for k in range(n)],
        "SI.POV.DDAY": [None] * n,
    }
    return pd.concat(
        [
            pd.DataFrame({"iso3": "AAA", "year": years, "indicator": k, "value": v})
            for k, v in rows.items()
        ],
        ignore_index=True,
    ).astype({"value": float})


def test_onset_requires_two_peaceful_years(cfg: Config) -> None:
    #        1989 1990 1991 1992 1993 1994 1995 1996
    deaths = [0, None, 30, 0, 40, None, None, 100]
    p = build_panel(_long(deaths), cfg).df.xs("AAA")
    # 1989 is the first recorded year; 1990 null -> 0; 1991 onset (1989, 1990 peaceful)
    assert p.loc[1991, "onset"] == 1
    assert p.loc[1993, "onset"] == 0  # only one peaceful year before (1992)
    assert p.loc[1996, "onset"] == 1
    # 1989-90 need deaths from 1987-88, before coverage -> unknown, not "no onset"
    assert np.isnan(p.loc[1989, "onset"]) and np.isnan(p.loc[1990, "onset"])


def test_missing_deaths_zero_only_from_first_year(cfg: Config) -> None:
    long = _long([None, None, 30, 0], start=1987)  # first non-null in 1989
    p = build_panel(long, cfg).df.xs("AAA")
    assert np.isnan(p.loc[1987, "deaths"]) and np.isnan(p.loc[1988, "deaths"])
    assert p.loc[1990, "deaths"] == 0


def test_fdi_ma_is_trailing(cfg: Config) -> None:
    no_winsor = cfg.model_copy(update={"fdi": FDICfg(ma_window=3, winsor=(0.0, 1.0))})
    p = build_panel(_long([0.0] * 8, start=1990), no_winsor).df.xs("AAA")
    # fdi_raw = 0,1,2,...; trailing 3-yr MA at index k = k-1 (for k >= 2)
    assert p.loc[1990 + 5, "fdi"] == 4.0
    assert p.loc[1991, "fdi"] == 0.5  # min_periods = window - 1
    assert np.isnan(p.loc[1990, "fdi"])


def test_winsor_bounds(panel: Panel) -> None:
    lo, hi = panel.fdi_winsor_bounds
    assert panel.df["fdi_w"].min() >= lo and panel.df["fdi_w"].max() <= hi
    assert lo < hi
