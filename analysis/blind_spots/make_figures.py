"""Figures for the Analysis page section "What the data can and can't show".

1. gdp_collapse.png  - real GDP per person (constant 2015 US$), pre-war year = 100,
                       against the country's own pre-war trend (5 years before the war).
2. missing_by_conflict.png - share of World Bank indicators missing, by conflict level.
Run missing_data_test.py first.
"""
import json
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "frontend" / "public" / "analysis_img"
d = pd.read_csv(HERE.parent / "expanded_analysis" / "country_year_levels.csv")
plt.rcParams.update({"font.size": 11, "axes.spines.top": False, "axes.spines.right": False})
INK, MUTED, WAR, TREND = "#2B2622", "#8A8178", "#A8592B", "#8A8178"

# ---- 1. GDP collapse --------------------------------------------------------
WARS = [("SYR", "Syria", 2011), ("YEM", "Yemen", 2015), ("LBY", "Libya", 2011)]
fig, axes = plt.subplots(1, 3, figsize=(12, 4), sharey=True)
summary = {}
for ax, (iso, name, start) in zip(axes, WARS):
    s = d[d.iso3 == iso].set_index("year")["NY.GDP.PCAP.KD"].dropna()
    base_year = start - 1
    pre = s.loc[base_year - 5 : base_year]
    g = (pre.iloc[-1] / pre.iloc[0]) ** (1 / (len(pre) - 1)) - 1
    s = s.loc[base_year - 5 :] / s[base_year] * 100
    yrs = [y for y in s.index if y >= base_year]
    trend = pd.Series([100 * (1 + g) ** (y - base_year) for y in yrs], index=yrs)
    ax.axvspan(start - 0.5, s.index.max() + 0.5, color=WAR, alpha=0.08, lw=0)
    ax.plot(trend.index, trend.values, ls="--", color=TREND, lw=1.5, label="pre-war trend")
    ax.plot(s.index, s.values, color=WAR, lw=2.2, label="actual")
    last = s.index.max()
    gap = s[last] / trend[last] - 1
    summary[name] = {"start": start, "last_year": int(last), "vs_trend_pct": round(100 * gap), "vs_prewar_pct": round(s[last] - 100)}
    ax.annotate("", (last + 0.35, s[last]), xytext=(last + 0.35, trend[last]),
                arrowprops={"arrowstyle": "<->", "color": WAR, "lw": 1.2})
    ax.text(last - 0.2, (s[last] + trend[last]) / 2, f"{100 * gap:+.0f}%\nvs trend", ha="right", va="center",
            color=WAR, fontweight="bold")
    ax.set_title(f"{name} (war from {start})", color=INK, loc="left")
    ax.axhline(100, color="#DDD6CE", lw=0.8, zorder=0)
    ax.tick_params(colors=MUTED)
axes[0].set_ylabel("Real GDP per person\n(year before war = 100)", color=INK)
axes[0].legend(frameon=False, loc="lower left")
fig.suptitle("Long wars cut income per person by a third to a half", x=0.01, ha="left", fontsize=14, color=INK)
fig.text(0.01, -0.02, "World Bank NY.GDP.PCAP.KD (constant 2015 US$). Trend = average growth in the 5 years before the war. "
         "Shaded = war years. Series end when World Bank data stops.", fontsize=9, color=MUTED)
fig.tight_layout()
fig.savefig(OUT / "gdp_collapse.png", dpi=150, bbox_inches="tight", facecolor="white")

# ---- 2. Missing data by conflict level --------------------------------------
res = json.loads((HERE / "missing_data_results.json").read_text(encoding="utf-8"))
groups = list(res["groups"])
bands = ["Calm (<1)", "Moderate (1-10)", "Severe (10+)"]
colors = ["#C9C1B8", "#C9772F", "#84502F"]
fig, ax = plt.subplots(figsize=(10, 4.2))
w = 0.26
for i, (b, c) in enumerate(zip(bands, colors)):
    vals = [100 * res["groups"][g]["raw_missing"][b] for g in groups]
    bars = ax.bar([x + (i - 1) * w for x in range(len(groups))], vals, w - 0.03, color=c, label=b)
    for bar, v in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2, v + 1.2, f"{v:.0f}%", ha="center", fontsize=9, color=INK)
ax.set_xticks(range(len(groups)), groups, color=INK)
ax.set_ylabel("Share of indicators missing", color=INK)
ax.set_ylim(0, 100)
ax.tick_params(colors=MUTED)
ax.legend(title="Political-violence deaths per 100,000 that year", frameon=False, loc="upper left", fontsize=9, title_fontsize=9)
ax.set_title("Where conflict is worst, the least gets measured", loc="left", fontsize=14, color=INK)
fig.text(0.01, -0.03, f"{res['n_country_years']:,} country-years, {res['n_countries']} countries, 1997-2023, ACLED-covered years only. "
         "World Bank WDI indicators grouped as shown.", fontsize=9, color=MUTED)
fig.tight_layout()
fig.savefig(OUT / "missing_by_conflict.png", dpi=150, bbox_inches="tight", facecolor="white")
(HERE / "gdp_collapse_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
print(json.dumps(summary, indent=2))
