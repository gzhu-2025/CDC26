"""Interface contract 1: indicator data from the ingestion pipeline -> modeling engine.

The ingestion pipeline writes ONE long-format Parquet file, ``data/indicators.parquet``:

    iso3       str    ISO 3166-1 alpha-3 country code (World Bank ``countryiso3code``)
    year       int    calendar year
    indicator  str    one of INDICATORS below
    value      float  nullable; null = not reported

Rules
- One row per (iso3, year, indicator); duplicates are rejected.
- Countries only: World Bank aggregates (WLD, SSF, HIC, ...) must be excluded. The engine
  also drops any code in WB_AGGREGATES on load (with a warning) as a safety net.
- VC.BTL.DETH is null for country-years with no recorded battle deaths. The engine treats
  null as 0 from the first year the series has any data (1989 in WB data).

Optional companion file ``data/countries.parquet`` (iso3, name, region, income_level) from
``/v2/country``. If absent, the engine falls back to iso3 codes as names.
"""

from __future__ import annotations

import pandera.pandas as pa
from pandera.typing import Series

INDICATORS: dict[str, str] = {
    "VC.BTL.DETH": "Battle-related deaths (number of people)",
    "SP.POP.TOTL": "Population, total",
    "NY.GDP.PCAP.KD": "GDP per capita (constant US$)",
    "BX.KLT.DINV.WD.GD.ZS": "Foreign direct investment, net inflows (% of GDP)",
    "SI.POV.DDAY": "Poverty headcount ratio at $2.15 a day (2017 PPP) (% of population)",
}

NONNEGATIVE_INDICATORS = frozenset({"VC.BTL.DETH", "SP.POP.TOTL", "NY.GDP.PCAP.KD", "SI.POV.DDAY"})

# World Bank region / income / lending aggregates (``region.value == "Aggregates"`` in /v2/country).
WB_AGGREGATES: frozenset[str] = frozenset(
    """AFE AFW ARB CEB CSS EAP EAR EAS ECA ECS EMU EUU FCS HIC HPC IBD IBT IDA IDB IDX INX LAC
    LCN LDC LIC LMC LMY LTE MEA MIC MNA NAC OED OSS PRE PSS PST SAS SSA SSF SST TEA TEC TLA
    TMN TSA TSS UMC WLD""".split()
)


class IndicatorsSchema(pa.DataFrameModel):
    iso3: Series[str] = pa.Field(str_matches=r"^[A-Z0-9]{3}$")
    year: Series[int] = pa.Field(ge=1960, le=2100)
    indicator: Series[str] = pa.Field(isin=list(INDICATORS))
    value: Series[float] = pa.Field(nullable=True)

    class Config:
        strict = "filter"  # extra columns are dropped, not an error
        coerce = True
        unique = ["iso3", "year", "indicator"]

    @pa.dataframe_check
    def nonnegative_where_required(cls, df):  # type: ignore[no-untyped-def]
        mask = df["indicator"].isin(NONNEGATIVE_INDICATORS) & df["value"].notna()
        return ~mask | (df["value"] >= 0)
