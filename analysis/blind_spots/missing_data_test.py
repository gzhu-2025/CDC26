"""Is World Bank data more often missing in high-conflict country-years?

Uses analysis/expanded_analysis/country_year_levels.csv (ACLED-covered country-years only).
Conflict level = ACLED total fatalities per 100,000 people that year.
Compares missing rates raw and within the same country (country fixed effect),
so "poor countries report less" does not drive the result.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
d = pd.read_csv(HERE.parent / "expanded_analysis" / "country_year_levels.csv")
d = d[(d.year >= 1997) & (d.year <= 2023)]  # 2024-25 not yet published for many series
d = d[d.total.notna() & d.population.gt(0)]
d["per100k"] = d.total / d.population * 1e5
d["band"] = pd.cut(d.per100k, [-1, 1, 10, np.inf], labels=["Calm (<1)", "Moderate (1-10)", "Severe (10+)"])

GROUPS = {
    "Economy": ["NY.GDP.PCAP.KD", "NE.CON.PRVT.PC.KD", "FP.CPI.TOTL.ZG", "NE.TRD.GNFS.ZS", "NE.GDI.TOTL.ZS", "BX.KLT.DINV.WD.GD.ZS"],
    "Health": ["SH.XPD.CHEX.GD.ZS", "SH.XPD.OOPC.CH.ZS", "SH.MED.PHYS.ZS", "SH.STA.BRTC.ZS", "SH.IMM.IDPT", "SH.TBS.INCD"],
    "Education": ["SE.PRM.CMPT.ZS", "SE.SEC.ENRR", "SE.ADT.LITR.ZS", "SE.XPD.TOTL.GD.ZS", "SE.PRM.UNER.ZS"],
    "Poverty & inequality": ["SI.POV.DDAY", "SI.POV.GINI"],
}
out = {"n_country_years": int(len(d)), "n_countries": int(d.iso3.nunique()),
       "level_counts": d.band.value_counts().sort_index().astype(int).to_dict(), "groups": {}}
for g, cols in GROUPS.items():
    miss = d[cols].isna().mean(axis=1)  # share of this group's indicators missing in the country-year
    raw = miss.groupby(d.band, observed=True).mean()
    # within-country: demean by country, then compare severe vs calm
    wc = miss - miss.groupby(d.iso3).transform("mean")
    both = d.groupby("iso3").band.transform(lambda s: {"Calm (<1)", "Severe (10+)"} <= set(s))
    wcd = wc[both].groupby(d.band[both], observed=True).mean()
    out["groups"][g] = {
        "raw_missing": {k: round(float(v), 3) for k, v in raw.items()},
        "within_country_severe_minus_calm_pp": round(100 * float(wcd["Severe (10+)"] - wcd["Calm (<1)"]), 1),
        "n_countries_with_both": int(d.iso3[both].nunique()),
    }
(HERE / "missing_data_results.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
print(json.dumps(out, indent=2))

# two-way check: missing share on severe/moderate dummies with country AND year fixed effects,
# standard errors clustered by country
import statsmodels.formula.api as smf

for g, cols in GROUPS.items():
    t = d.assign(miss=d[cols].isna().mean(axis=1),
                 severe=(d.band == "Severe (10+)").astype(float),
                 moderate=(d.band == "Moderate (1-10)").astype(float))
    fit = smf.ols("miss ~ severe + moderate + C(iso3) + C(year)", t).fit(cov_type="cluster", cov_kwds={"groups": t.iso3.astype("category").cat.codes})
    out["groups"][g]["twfe_severe_pp"] = round(100 * fit.params["severe"], 1)
    out["groups"][g]["twfe_severe_ci_pp"] = [round(100 * v, 1) for v in fit.conf_int().loc["severe"]]
    out["groups"][g]["twfe_severe_p"] = round(float(fit.pvalues["severe"]), 4)
(HERE / "missing_data_results.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
print({g: {k: v for k, v in r.items() if k.startswith("twfe")} for g, r in out["groups"].items()})
