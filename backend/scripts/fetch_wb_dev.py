"""Dev-only World Bank pull so the engine can be tested on real data.

Writes the Contract-1 long format to backend/dev_cache/ (NOT data/, which the
ingestion teammate owns). Once data/indicators.parquet exists, prefer that.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import requests

BASE = "https://api.worldbank.org/v2"
INDICATORS = [
    "VC.BTL.DETH",
    "SP.POP.TOTL",
    "NY.GDP.PCAP.KD",
    "BX.KLT.DINV.WD.GD.ZS",
    "SI.POV.DDAY",
]
OUT_DIR = Path(__file__).resolve().parents[1] / "dev_cache"


def _get_all(url: str, params: dict[str, str | int]) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        r = requests.get(url, params={**params, "format": "json", "page": page}, timeout=60)
        r.raise_for_status()
        meta, data = r.json()
        rows.extend(data or [])
        if page >= int(meta["pages"]):
            return rows
        page += 1


def fetch_countries() -> pd.DataFrame:
    rows = _get_all(f"{BASE}/country", {"per_page": 400})
    df = pd.DataFrame(
        {
            "iso3": [c["id"] for c in rows],
            "name": [c["name"] for c in rows],
            "region": [c["region"]["value"].strip() for c in rows],
            "income_level": [c["incomeLevel"]["value"] for c in rows],
            # capital-city coordinates, used for neighbor spillover weights
            "latitude": pd.to_numeric([c["latitude"] or None for c in rows], errors="coerce"),
            "longitude": pd.to_numeric([c["longitude"] or None for c in rows], errors="coerce"),
        }
    )
    return df[df["region"] != "Aggregates"].reset_index(drop=True)


def fetch_indicator(code: str, start: int = 1960, end: int = 2024) -> pd.DataFrame:
    rows = _get_all(
        f"{BASE}/country/all/indicator/{code}", {"date": f"{start}:{end}", "per_page": 20000}
    )
    return pd.DataFrame(
        {
            "iso3": [r["countryiso3code"] for r in rows],
            "year": [int(r["date"]) for r in rows],
            "indicator": code,
            "value": [r["value"] for r in rows],
        }
    )


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    countries = fetch_countries()
    countries.to_parquet(OUT_DIR / "countries.parquet", index=False)
    frames = []
    for code in INDICATORS:
        df = fetch_indicator(code)
        print(f"{code}: {len(df)} rows, {df['value'].notna().sum()} non-null")
        frames.append(df)
    long = pd.concat(frames, ignore_index=True)
    long = long[long["iso3"].isin(countries["iso3"])]
    long["value"] = long["value"].astype("float64")
    long.to_parquet(OUT_DIR / "indicators.parquet", index=False)
    print(f"countries={len(countries)} rows={len(long)} -> {OUT_DIR}")


if __name__ == "__main__":
    main()
