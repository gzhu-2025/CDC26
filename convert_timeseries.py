"""Save main datasets as date-indexed pandas DataFrames beside their sources.

Requires pandas and openpyxl. Run with: python convert_timeseries.py
Load an output with pd.read_pickle(path). Dates can repeat across countries and
event categories; no observations are aggregated, imputed, or discarded.
"""

from pathlib import Path
import hashlib

import pandas as pd


DATA = Path(__file__).resolve().parent / "data"


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def convert(path):
    if path.suffix.lower() == ".csv":
        frame = pd.read_csv(path, skiprows=4)
        # World Bank exports have an empty trailing column.
        frame = frame.drop(columns=[
            c for c in frame if c.startswith("Unnamed:") and frame[c].isna().all()
        ])
        years = [c for c in frame if str(c).isdigit() and len(str(c)) == 4]
        if not years:
            raise ValueError(f"No annual columns in {path}")
        identifiers = [c for c in frame if c not in years]
        result = frame.melt(
            id_vars=identifiers, value_vars=years, var_name="year", value_name="value"
        )
        dates = pd.to_datetime(result["year"], format="%Y")
        result["year"] = result["year"].astype(int)
        assert len(result) == len(frame) * len(years)
        assert result["value"].notna().sum() == frame[years].notna().sum().sum()
        frequency = "annual"
    else:
        with pd.ExcelFile(path) as workbook:
            if len(workbook.sheet_names) != 1:
                raise ValueError(f"Expected one data sheet: {path}")
            result = pd.read_excel(workbook)
        if "WEEK" in result:
            if pd.api.types.is_numeric_dtype(result["WEEK"]):
                dates = pd.to_datetime(result["WEEK"], unit="D", origin="1899-12-30")
            else:
                dates = pd.to_datetime(result["WEEK"])
            frequency = "weekly"
        elif "MONTH" in result and "YEAR" in result:
            dates = pd.to_datetime(
                result["YEAR"].astype(str) + "-" + result["MONTH"], format="%Y-%B"
            )
            frequency = "monthly"
        elif "YEAR" in result:
            dates = pd.to_datetime(result["YEAR"].astype(str), format="%Y")
            frequency = "annual"
        else:
            raise ValueError(f"No recognized time column: {path}")
    result.index = pd.DatetimeIndex(dates, name="date")
    result = result.sort_index(kind="stable")
    assert not result.index.hasnans
    result.attrs.update(source_file=path.name, observation_frequency=frequency)
    return result


def main():
    originals = sorted(p for p in DATA.rglob("*") if p.suffix.lower() in {".csv", ".xlsx"})
    hashes = {p: checksum(p) for p in originals}
    sources = [p for p in originals if "metadata" not in p.name.lower()]
    for path in sources:
        result = convert(path)
        output = path.with_suffix(".pkl")
        result.to_pickle(output)
        restored = pd.read_pickle(output)
        pd.testing.assert_frame_equal(result, restored)
        assert restored.index.is_monotonic_increasing
        print(f"{output.relative_to(DATA)}: {len(result):,} rows, "
              f"{result.index.min().date()} to {result.index.max().date()}", flush=True)
    assert all(checksum(p) == digest for p, digest in hashes.items())
    print(f"Saved and verified {len(sources)} time series. All source and metadata files unchanged.")


if __name__ == "__main__":
    main()
