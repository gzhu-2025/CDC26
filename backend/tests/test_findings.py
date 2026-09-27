from __future__ import annotations

import json

import numpy as np
import pytest

from conflict_sim import findings_text as T
from conflict_sim.api.schemas import Findings
from conflict_sim.config import default_config

FINDINGS = default_config().artifacts_dir / "findings.json"


# ---------- rounding ----------
@pytest.mark.parametrize(
    ("v", "expected"),
    [
        (1_234_567, "1.2 million"),
        (23_456, "23,000"),
        (2_000_000, "2 million"),
        (0, "0"),
        (987, "990"),
    ],
)
def test_people_two_significant_figures(v: float, expected: str) -> None:
    assert T.people(v) == expected


def test_pct_whole_numbers() -> None:
    assert T.pct(-13.6) == "14" and T.pct(0.4) == "0"


# ---------- effects never claimed when the band includes zero ----------
def test_effect_sentence_branches() -> None:
    neg = T.effect_sentence("Five years after", "GDP per person", -14, -24, -5)
    assert neg == "Five years after, GDP per person is typically 14% lower (range 5% to 24% lower)."
    pos = T.effect_sentence("Later", "GDP per person", 3, 1, 6)
    assert "3% higher" in pos
    zero = T.effect_sentence("Ten years after", "GDP per person", -4, -12, 3)
    assert "can't distinguish" in zero and "%" not in zero


def test_no_sentence_claims_an_effect_whose_band_includes_zero() -> None:
    rng = np.random.default_rng(0)
    for _ in range(2000):
        lo, hi = sorted(rng.normal(0, 10, 2))
        mid = rng.uniform(lo, hi)
        s = T.effect_sentence("At h", "GDP per person", mid, lo, hi)
        if lo <= 0 <= hi:
            assert "can't distinguish" in s and "typically" not in s
        else:
            assert "typically" in s


def test_pretrend_branches() -> None:
    assert "already declining" in T.pretrend_sentence(True)
    assert "near zero" in T.pretrend_sentence(False)


# ---------- world right now ----------
@pytest.mark.parametrize(
    ("prev", "phrase"),
    [(100_000, "about the same"), (80_000, "more than"), (150_000, "fewer than"), (0, None)],
)
def test_world_now_branches(prev: float, phrase: str | None) -> None:
    s = T.world_now_sentences(102_000, prev, 5, 3, 12)
    assert s[0].startswith("In the last 12 months, about 100,000 people")
    assert "12 countries are at war" in s[-1] and "5 are escalating" in s[-1]
    if phrase:
        assert phrase in s[1]
    else:
        assert len(s) == 2


# ---------- longer wars ----------
def _dur(mids: list[float], lo_last: float = -40, hi_last: float = -5) -> list[dict]:
    items = [
        {"duration": d, "mid": m, "lo": m - 5, "hi": m + 2}
        for d, m in zip((1, 3, 5, 10), mids, strict=True)
    ]
    items[-1].update(lo=lo_last, hi=hi_last)
    return items


def test_longer_wars_diminishing() -> None:
    s = T.longer_wars_sentences(_dur([-8, -14, -18, -22]), (-1.5, -2.5, -0.4))
    assert "Each extra year adds less" in s[1] and "10-year war" in s[0]


def test_longer_wars_diminishing_not_distinguishable() -> None:
    s = T.longer_wars_sentences(_dur([-8, -14, -18, -22]), (-1.5, -4.0, 1.0))
    assert "can't tell whether later years" in s[1]


def test_longer_wars_later_hurt_more() -> None:
    s = T.longer_wars_sentences(_dur([-2, -6, -10, -30]), (2.0, 0.5, 3.5))
    assert "hurt more" in s[1]


def test_longer_wars_band_includes_zero() -> None:
    s = T.longer_wars_sentences(_dur([-8, -14, -18, -22], lo_last=-40, hi_last=3), (-1, -2, -0.1))
    assert "can't distinguish" in s[0]


# ---------- borders, poverty ----------
def test_borders_branches() -> None:
    assert len(T.borders_sentences(-2, -4, -0.5, 500, "Moldova")) == 2
    only = T.borders_sentences(-2, -4, 1, 500, None)
    assert len(only) == 1 and "can't distinguish" in only[0]


def test_poverty_branches() -> None:
    assert "not estimated to push" in T.poverty_sentences(0, 0, 0, 0, None)[0]
    unsure = T.poverty_sentences(3_456_789, -20_000, 9_000_000, 30, "Sudan")
    assert "can't rule out no change" in unsure[0] and "could fall" not in unsure[0]
    assert "Sudan" in unsure[1]
    sure = T.poverty_sentences(3_456_789, 1_000_000, 9_000_000, 30, None)
    assert "could fall" in sure[0] and "range 1 million to 9 million" in sure[0] and len(sure) == 1


# ---------- heterogeneity ----------
def _het(winner: str | None) -> dict:
    return {
        "winner": winner,
        "candidates": [
            {"variant": "interactions", "wins_vs_pooled": 21 if winner else 14, "n_wars": 29},
            {"variant": "regional_eb", "wins_vs_pooled": 12, "n_wars": 29},
        ],
    }


def test_heterogeneity_branches() -> None:
    assert "not been run" in T.heterogeneity_sentences(None)[0]
    no = T.heterogeneity_sentences(_het(None))
    assert no[0] == (
        "We tested whether war hurts some kinds of economies more; the data can't tell "
        "them apart reliably yet."
    )
    assert "better on 14 of 29" in no[1]
    yes = T.heterogeneity_sentences(_het("interactions"))
    assert "resource rents and aid" in yes[0] and "21 of 29" in yes[0]


# ---------- backtest ----------
@pytest.mark.parametrize(("wins", "word"), [(20, "(most)"), (14, "(fewer than half)")])
def test_backtest_branches(wins: int, word: str) -> None:
    s = T.backtest_sentences(29, 0.66, wins, 2.3)
    assert "66% of the time" in s[0] and word in s[1] and "2.3 times wider" in s[2]
    assert len(T.backtest_sentences(28, 0.9, 14, 1.0)) == 2
    assert "(about half)" in T.backtest_sentences(28, 0.9, 14, 1.0)[1]


# ---------- limits ----------
def test_missing_data_both_directions() -> None:
    assert T.missing_data_sentence(4, 6, 20, 90).startswith("Data disappears in the worst wars")
    s = T.missing_data_sentence(7, 3, 5, 85)
    assert "mostly still reported" in s and "85%" in s


def test_fdi_branches() -> None:
    assert "too noisy" in T.fdi_sentence(0, 11)
    assert "2 of 11" in T.fdi_sentence(2, 11)


# ---------- generated file ----------
@pytest.mark.skipif(not FINDINGS.exists(), reason="run python -m conflict_sim.findings first")
def test_findings_json_schema_and_rules() -> None:
    data = json.loads(FINDINGS.read_text())
    f = Findings.model_validate(data)
    ids = [s.id for s in f.sections]
    assert ids == [
        "world_now",
        "war_effect",
        "longer_wars",
        "borders",
        "poverty",
        "heterogeneity",
        "backtest",
        "about",
        "limits",
    ]
    for s in f.sections:
        assert s.sentences and s.sr_summary and s.heading[0].isupper()
    war = next(s for s in data["sections"] if s["id"] == "war_effect")
    for check in war["horizon_checks"]:  # sentences for h=1,5,10 follow their bands
        if check["h"] in (1, 5, 10):
            label = {1: "One year", 5: "Five years", 10: "Ten years"}[check["h"]]
            sentence = next(x for x in war["sentences"] if x.startswith(label))
            assert ("can't distinguish" in sentence) == (not check["band_excludes_zero"])
