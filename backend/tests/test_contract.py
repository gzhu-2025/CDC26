from __future__ import annotations

from pathlib import Path

import pandas as pd
import pandera.errors
import pytest

from conflict_sim.contracts import IndicatorsSchema
from conflict_sim.io import load_indicators


def _df(**overrides: list[object]) -> pd.DataFrame:
    base: dict[str, list[object]] = {
        "iso3": ["KEN", "KEN"],
        "year": [2000, 2000],
        "indicator": ["NY.GDP.PCAP.KD", "SP.POP.TOTL"],
        "value": [1000.0, 3e7],
    }
    return pd.DataFrame({**base, **overrides})


def test_valid_frame_passes() -> None:
    IndicatorsSchema.validate(_df())


@pytest.mark.parametrize(
    "overrides",
    [
        {"indicator": ["NY.GDP.PCAP.KD", "NOT.AN.INDICATOR"]},
        {"iso3": ["KEN", "kenya"]},
        {"indicator": ["NY.GDP.PCAP.KD", "NY.GDP.PCAP.KD"]},  # duplicate key
        {"value": [-5.0, 3e7]},  # negative GDP
        {"year": [2000, 1800]},
    ],
)
def test_invalid_frames_rejected(overrides: dict[str, list[object]]) -> None:
    with pytest.raises(pandera.errors.SchemaErrors):
        IndicatorsSchema.validate(_df(**overrides), lazy=True)


def test_negative_fdi_allowed() -> None:
    IndicatorsSchema.validate(
        _df(indicator=["BX.KLT.DINV.WD.GD.ZS", "SP.POP.TOTL"], value=[-3.0, 1.0])
    )


def test_null_values_allowed() -> None:
    IndicatorsSchema.validate(_df(value=[None, None]))


def test_aggregates_dropped_with_warning(tmp_path: Path) -> None:
    df = pd.concat([_df(), _df(iso3=["WLD", "SSF"])], ignore_index=True)
    df.to_parquet(tmp_path / "x.parquet")
    out, warnings = load_indicators(tmp_path / "x.parquet")
    assert set(out["iso3"]) == {"KEN"}
    assert warnings and "WLD" in warnings[0]


def test_fixture_matches_contract(fixture_path: Path) -> None:
    df, warnings = load_indicators(fixture_path)
    assert warnings == []
    assert df["iso3"].nunique() == 40
    assert (df["year"].min(), df["year"].max()) == (1990, 2023)
