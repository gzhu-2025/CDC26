"""OFFLINE estimation: local projections + country cluster bootstrap -> artifacts/.

All estimates are associational (conditional correlations with two-way fixed effects),
not identified causal effects: conflict is not randomly assigned, and GDP shocks can
themselves raise the risk of conflict.
"""

OUTCOMES: dict[str, tuple[str, str]] = {"gdp": ("lngdp", "dlngdp"), "fdi": ("fdi", "dfdi")}
MEASURES: dict[str, str] = {"continuous": "x", "onset": "onset"}
