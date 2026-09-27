"""Sentence templates for the findings page. Every sentence is chosen by conditions on the
numbers; nothing is hand-written per release. Kept separate so every branch is unit-tested.

Rules: percents are whole numbers, people are 2 significant figures, and an effect is only
ever stated as an effect when its 90% band excludes zero.
"""

from __future__ import annotations

import math
from typing import Any


# ---------- rounding ----------
def pct(v: float) -> str:
    """Whole-number percent magnitude, e.g. 13.6 -> '14'. Sign is carried by the wording."""
    return f"{abs(v):.0f}"


def people(v: float) -> str:
    """2 significant figures with words: 1_234_567 -> '1.2 million', 23_456 -> '23,000'."""
    if v == 0:
        return "0"
    mag = math.floor(math.log10(abs(v)))
    r = round(v, -mag + 1)
    if abs(r) >= 1e6:
        return f"{r / 1e6:.2g} million".replace(".0 ", " ")
    return f"{r:,.0f}"


def band_excludes_zero(lo: float, hi: float) -> bool:
    return (lo > 0 and hi > 0) or (lo < 0 and hi < 0)


# ---------- effect statements ----------
def effect_sentence(when: str, subject: str, mid: float, lo: float, hi: float) -> str:
    """'Five years after …, GDP per person is typically 14% lower (range 24% to 5% lower).'
    or, if the band includes zero, that we can't distinguish it from zero."""
    if not band_excludes_zero(lo, hi):
        return f"{when}, we can't distinguish the effect on {subject} from zero at this horizon."
    direction = "lower" if mid < 0 else "higher"
    a, b = sorted((abs(lo), abs(hi)))
    return (
        f"{when}, {subject} is typically {pct(mid)}% {direction} "
        f"(range {pct(a)}% to {pct(b)}% {direction})."
    )


def pretrend_sentence(leads_significant: bool) -> str:
    if leads_significant:
        return (
            "Economies were often already declining before these wars, so part of this may not "
            "be caused by the war itself."
        )
    return "In the years before these wars, economies were not already sliding: the pre-war years sit near zero."


# ---------- world right now ----------
def world_now_sentences(
    killed_12m: float, killed_prev_12m: float, escalating: int, calming: int, at_war: int
) -> list[str]:
    out = [
        f"In the last 12 months, about {people(killed_12m)} people were killed in political "
        f"violence worldwide."
    ]
    if killed_prev_12m > 0:
        change = (killed_12m / killed_prev_12m - 1) * 100
        if abs(change) < 5:
            out.append("That is about the same as the 12 months before.")
        else:
            out.append(
                f"That is {pct(change)}% {'more' if change > 0 else 'fewer'} than the 12 months before."
            )
    out.append(
        f"{at_war} countries are at war by our definition; in the last three months, "
        f"{escalating} are escalating and {calming} are calming."
    )
    return out


# ---------- longer wars ----------
def longer_wars_sentences(
    by_duration: list[dict[str, Any]], later_vs_first: tuple[float, float, float]
) -> list[str]:
    """by_duration: [{duration, mid, lo, hi}] cumulative % effect after 10 years.
    later_vs_first: (mid, lo, hi) of |cost of a later war year| - |cost of the first year|,
    across draws; 'each extra year adds less' is only claimed if its band is below zero."""
    last = by_duration[-1]
    out = []
    if band_excludes_zero(last["lo"], last["hi"]):
        out.append(
            f"A {last['duration']}-year war leaves GDP per person about {pct(last['mid'])}% "
            f"{'lower' if last['mid'] < 0 else 'higher'} after 10 years "
            f"(range {pct(min(abs(last['lo']), abs(last['hi'])))}% to "
            f"{pct(max(abs(last['lo']), abs(last['hi'])))}%)."
        )
    else:
        out.append(
            f"Even for a {last['duration']}-year war, we can't distinguish the 10-year "
            f"effect from zero."
        )
    mid, lo, hi = later_vs_first
    if hi < 0:
        out.append(
            f"Each extra year adds less: later years of a war cost about {abs(mid):.1f} "
            f"percentage points less per year than the first."
        )
    elif lo > 0:
        out.append("In this data, later years of a war hurt more than the first.")
    else:
        out.append("The data can't tell whether later years of a war hurt less than the first.")
    return out


# ---------- borders ----------
def borders_sentences(
    mid: float, lo: float, hi: float, km: float, top_name: str | None
) -> list[str]:
    out = [
        effect_sentence(
            f"Ten years after a year of civil-war-level fighting next door ({km:.0f} km away)",
            "a neighbor's GDP per person",
            mid,
            lo,
            hi,
        )
    ]
    if top_name:
        out.append(f"Right now, {top_name} is the most exposed to fighting in nearby countries.")
    return out


# ---------- poverty ----------
def poverty_sentences(
    total_mid: float, total_lo: float, total_hi: float, n_countries: int, top_name: str | None
) -> list[str]:
    if total_mid <= 0 and total_hi <= 0:
        return [
            "Current conflicts are not estimated to push additional people into extreme poverty."
        ]
    if total_lo <= 0:  # range includes no increase: don't state it as an effect
        out = [
            f"If today's conflicts continued five years, our middle estimate is about "
            f"{people(total_mid)} more people below $2.15 a day across {n_countries} countries, "
            f"but the range runs from no increase to {people(total_hi)}, so we can't rule out "
            f"no change."
        ]
    else:
        out = [
            f"If today's conflicts continued five years, about {people(total_mid)} more people "
            f"could fall below $2.15 a day (range {people(total_lo)} to {people(total_hi)}), "
            f"across {n_countries} countries with recent poverty surveys."
        ]
    if top_name:
        out.append(f"The largest share would be in {top_name}.")
    return out


# ---------- heterogeneity ----------
LABELS = {"interactions": "resource rents and aid", "regional_eb": "region"}


def heterogeneity_sentences(result: dict[str, Any] | None) -> list[str]:
    if result is None:
        return ["The test of whether war hurts some economies more has not been run yet."]
    cands = {c["variant"]: c for c in result["candidates"]}
    detail = "; ".join(
        f"{LABELS.get(v, v)}: better on {c['wins_vs_pooled']} of {c['n_wars']}"
        for v, c in cands.items()
    )
    if result.get("winner") is None:
        return [
            "We tested whether war hurts some kinds of economies more; the data can't tell them "
            "apart reliably yet.",
            f"Neither pre-registered model beat the simple one on enough held-out wars ({detail}; "
            f"passing required 20 and better-calibrated ranges).",
        ]
    w = cands[result["winner"]]
    return [
        f"Taking {LABELS.get(w['variant'], w['variant'])} into account predicted {w['wins_vs_pooled']} "
        f"of {w['n_wars']} held-out wars better than a one-size-fits-all model, and passed our "
        f"pre-registered test.",
        f"Full comparison: {detail}.",
    ]


# ---------- backtest ----------
def backtest_sentences(n: int, coverage: float, wins: int, k: float) -> list[str]:
    out = [
        f"Tested on {n} past wars it had never seen, the real outcome landed inside our 90% "
        f"range {pct(coverage * 100)}% of the time; a well-calibrated model would get about 90%."
    ]
    half = n / 2
    verdict = "most" if wins > half else "about half" if wins == half else "fewer than half"
    out.append(
        f"Our prediction beat simply assuming the war changed nothing on {wins} of {n} wars ({verdict})."
    )
    if coverage < 0.85:
        out.append(
            f"Our ranges are too narrow: they would need to be about {k:.1f} times wider to "
            f"contain 90% of real outcomes."
        )
    return out


# ---------- limits ----------
def missing_data_sentence(peace: float, minor: float, intense: float, pov_intense: float) -> str:
    """Shares of country-years with GDP missing, by conflict tier, in percent."""
    if intense - peace >= 5:
        return (
            f"Data disappears in the worst wars: GDP figures are missing for {pct(intense)}% of "
            f"country-years in the most intense conflicts, versus {pct(peace)}% in peacetime, so "
            f"the worst cases are under-represented."
        )
    return (
        f"GDP figures are mostly still reported during wars ({pct(intense)}% missing in the most "
        f"intense conflicts, {pct(peace)}% in peacetime); what disappears is poverty surveys, "
        f"missing for {pct(pov_intense)}% of the most intense conflict years."
    )


def fdi_sentence(n_significant: int, n_horizons: int) -> str:
    if n_significant == 0:
        return (
            "Foreign investment is too noisy to estimate: at no horizon can we distinguish the "
            "effect of war from zero, so we don't show it."
        )
    return (
        f"Effects on foreign investment are only distinguishable from zero at {n_significant} of "
        f"{n_horizons} horizons, so we treat them as unreliable and don't show them."
    )


def conversion_sentence(factor: float, lo: float, hi: float, n: int, africa_share: float) -> str:
    return (
        f"Recent conflict deaths come from ACLED and are converted to the battle-death scale the "
        f"model was built on: 1 ACLED battle death counts as {factor:.2f} (middle half of "
        f"country-years {lo:.2f} to {hi:.2f}), fitted on {n} country-years, {pct(africa_share * 100)}% "
        f"of them in Africa."
    )
