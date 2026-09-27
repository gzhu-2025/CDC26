"""ACLED loader: regional weekly aggregates -> weekly country table keyed by ISO3.

Reads data/Conflict/*_aggregated_data_*.xlsx (raw ACLED files are local-only; see README)
and caches a compact parquet in dev_cache/, invalidated by a hash of the source files.

Columns per (iso3, week):
    pv_fat      political-violence fatalities (DISORDER_TYPE contains "Political violence")
    battle_fat  Battles + Explosions/Remote violence fatalities (UCDP battle-death scope;
                excludes violence against civilians)
    unrest_ev   Protests + Riots events
Coverage start is per ACLED region (first week any country in that region appears),
because a country with no events early on is covered-and-quiet, not missing.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from conflict_sim.config import REPO_ROOT, Config

log = logging.getLogger(__name__)

ACLED_DIR = REPO_ROOT / "data" / "Conflict"
PATTERN = "*_aggregated_data_*.xlsx"
BATTLE_TYPES = {"Battles", "Explosions/Remote violence"}
UNREST_TYPES = {"Protests", "Riots"}

# ACLED country names that differ from World Bank names (None = not a country: oceans, bases)
NAME_TO_ISO3: dict[str, str | None] = {
    "Akrotiri and Dhekelia": None,
    "Arctic Ocean": None,
    "Atlantic Ocean": None,
    "Indian Ocean": None,
    "Mediterranean Sea": None,
    "Pacific Ocean": None,
    "Southern Ocean": None,
    "Anguilla": "AIA",
    "Antarctica": "ATA",
    "Bahamas": "BHS",
    "Bailiwick of Guernsey": "GGY",
    "Bailiwick of Jersey": "JEY",
    "British Indian Ocean Territory": "IOT",
    "Brunei": "BRN",
    "Cape Verde": "CPV",
    "Caribbean Netherlands": "BES",
    "Christmas Island": "CXR",
    "Cook Islands": "COK",
    "Czech Republic": "CZE",
    "Democratic Republic of Congo": "COD",
    "East Timor": "TLS",
    "Egypt": "EGY",
    "Falkland Islands": "FLK",
    "French Guiana": "GUF",
    "Gambia": "GMB",
    "Guadeloupe": "GLP",
    "Iran": "IRN",
    "Ivory Coast": "CIV",
    "Kyrgyzstan": "KGZ",
    "Laos": "LAO",
    "Martinique": "MTQ",
    "Mayotte": "MYT",
    "Micronesia": "FSM",
    "Montserrat": "MSR",
    "Nauru": "NRU",
    "Niue": "NIU",
    "North Korea": "PRK",
    "Palestine": "PSE",
    "Puerto Rico": "PRI",
    "Republic of Congo": "COG",
    "Reunion": "REU",
    "Russia": "RUS",
    "Saint Helena, Ascension and Tristan da Cunha": "SHN",
    "Saint Kitts and Nevis": "KNA",
    "Saint Lucia": "LCA",
    "Saint Pierre and Miquelon": "SPM",
    "Saint Vincent and the Grenadines": "VCT",
    "Saint-Barthelemy": "BLM",
    "Saint-Martin": "MAF",
    "Sint Maarten": "SXM",
    "Slovakia": "SVK",
    "Somalia": "SOM",
    "South Korea": "KOR",
    "Syria": "SYR",
    "Taiwan": "TWN",
    "Tokelau": "TKL",
    "Turkey": "TUR",
    "Vatican City": "VAT",
    "Venezuela": "VEN",
    "Vietnam": "VNM",
    "Virgin Islands, U.S.": "VIR",
    "Wallis and Futuna": "WLF",
    "Yemen": "YEM",
    "eSwatini": "SWZ",
}


@dataclass(frozen=True)
class Acled:
    weekly: pd.DataFrame  # MultiIndex (iso3, week) -> pv_fat, battle_fat, unrest_ev
    coverage_start: pd.Series  # iso3 -> first covered week (Timestamp)
    as_of: pd.Timestamp  # last week in the data
    unmapped: list[str]

    @property
    def countries(self) -> list[str]:
        return sorted(self.coverage_start.index)

    def country(self, iso3: str) -> pd.DataFrame:
        """Full weekly grid from coverage start to as_of; covered weeks without events = 0."""
        if iso3 not in self.coverage_start.index:
            return pd.DataFrame(columns=["pv_fat", "battle_fat", "unrest_ev"], dtype=float)
        weeks = pd.date_range(self.coverage_start[iso3], self.as_of, freq="7D")
        if iso3 in self.weekly.index.get_level_values("iso3"):
            d = self.weekly.xs(iso3, level="iso3")
        else:
            d = pd.DataFrame(columns=["pv_fat", "battle_fat", "unrest_ev"], dtype=float)
        # ACLED weeks all fall on the same weekday, so an exact reindex is safe
        return d.reindex(weeks, fill_value=0.0).astype(float)


def _files() -> list[Path]:
    return sorted(ACLED_DIR.glob(PATTERN))


def _hash(files: list[Path]) -> str:
    h = hashlib.sha256()
    for f in files:
        h.update(f.name.encode())
        h.update(hashlib.sha256(f.read_bytes()).digest())
    return h.hexdigest()[:16]


def _read_raw(files: list[Path], wb_names: dict[str, str]) -> tuple[pd.DataFrame, list[str]]:
    frames = []
    for f in files:
        frames.append(
            pd.read_excel(
                f,
                engine="calamine",
                usecols=[
                    "WEEK",
                    "REGION",
                    "COUNTRY",
                    "EVENT_TYPE",
                    "DISORDER_TYPE",
                    "EVENTS",
                    "FATALITIES",
                ],
            )
        )
    raw = pd.concat(frames, ignore_index=True)
    name_map = {**wb_names, **NAME_TO_ISO3}
    raw["iso3"] = raw["COUNTRY"].map(name_map)
    unmapped = sorted(
        set(raw.loc[raw["iso3"].isna() & ~raw["COUNTRY"].isin(NAME_TO_ISO3), "COUNTRY"])
    )
    raw = raw.dropna(subset=["iso3"])
    raw["week"] = pd.to_datetime(raw["WEEK"])
    pv = raw["DISORDER_TYPE"].astype(str).str.contains("Political violence")
    raw["pv_fat"] = np.where(pv, raw["FATALITIES"], 0)
    raw["battle_fat"] = np.where(raw["EVENT_TYPE"].isin(BATTLE_TYPES), raw["FATALITIES"], 0)
    raw["unrest_ev"] = np.where(raw["EVENT_TYPE"].isin(UNREST_TYPES), raw["EVENTS"], 0)
    region_start = raw.groupby("REGION")["week"].min()
    raw["region_start"] = raw["REGION"].map(region_start)
    return raw, unmapped


def load_acled(cfg: Config, wb_countries: pd.DataFrame | None) -> Acled | None:
    """Load (and cache) ACLED; None if the raw files are not present locally."""
    files = _files()
    if not files:
        return None
    cache = cfg.resolve("dev_cache") / "acled_weekly.parquet"
    meta = cache.with_suffix(".meta.parquet")
    key = _hash(files)
    if cache.exists() and meta.exists():
        m = pd.read_parquet(meta)
        if m["key"].iloc[0] == key:
            weekly = pd.read_parquet(cache)
            cov = pd.read_parquet(meta.with_name("acled_coverage.parquet"))["start"]
            return Acled(weekly, cov, pd.Timestamp(m["as_of"].iloc[0]), list(m["unmapped"].iloc[0]))
    log.info("reading ACLED (%d files); cached afterwards", len(files))
    wb_names = {} if wb_countries is None else {n: i for i, n in wb_countries["name"].items()}
    raw, unmapped = _read_raw(files, wb_names)
    weekly = raw.groupby(["iso3", "week"])[["pv_fat", "battle_fat", "unrest_ev"]].sum()
    cov = raw.groupby("iso3")["region_start"].min().rename("start")
    as_of = raw["week"].max()
    cache.parent.mkdir(parents=True, exist_ok=True)
    weekly.to_parquet(cache)
    cov.to_frame().to_parquet(meta.with_name("acled_coverage.parquet"))
    pd.DataFrame({"key": [key], "as_of": [as_of], "unmapped": [unmapped]}).to_parquet(meta)
    return Acled(weekly, cov, as_of, unmapped)
