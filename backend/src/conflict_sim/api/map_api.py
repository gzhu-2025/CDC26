"""Map + country-panel endpoints, served from artifacts/map_metrics.json.

    GET /map?metric=<name>        -> {iso3: {value, lo, hi, confidence, as_of}}
    GET /map/metrics              -> metric list (label, unit, meaning, scale type)
    GET /country/{iso3}/summary   -> everything the country panel shows

Estimates are associational, not proof of cause.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query

from conflict_sim.api.schemas import (
    CountrySummary,
    Envelope,
    ErrorBody,
    FatalityPoint,
    Findings,
    MapValue,
    Meta,
    MetricInfo,
    MetricRow,
)
from conflict_sim.config import REPO_ROOT
from conflict_sim.warnings import Warn

NE_GEOJSON = REPO_ROOT / "frontend" / "public" / "geo" / "ne_50m_admin_0_countries.geojson"
ISO_JOIN = REPO_ROOT / "frontend" / "src" / "map-layers" / "isoJoin.json"
SOURCES = [
    "ACLED (Armed Conflict Location & Event Data), acleddata.com",
    "World Bank World Development Indicators",
    "UCDP battle-related deaths (via World Bank VC.BTL.DETH)",
]


def join_code(props: dict[str, Any], overrides: dict[str, str]) -> str | None:
    """The engine iso3 for a Natural Earth feature: ISO_A3_EH, never ISO_A3 (which is -99 for
    France and Norway); where ISO_A3_EH is also -99 (Kosovo, Somaliland, N. Cyprus) use the
    ADM0_A3 override table shared with the frontend."""
    if props["ISO_A3_EH"] != "-99":
        return str(props["ISO_A3_EH"])
    return overrides.get(props["ADM0_A3"])


def natural_earth_names() -> dict[str, str]:
    """iso3 -> Natural Earth NAME for every joinable map feature."""
    if not NE_GEOJSON.exists():
        return {}
    overrides = json.loads(ISO_JOIN.read_text())["overrides"] if ISO_JOIN.exists() else {}
    feats = json.loads(NE_GEOJSON.read_text(encoding="utf-8"))["features"]
    out: dict[str, str] = {}
    for f in feats:
        code = join_code(f["properties"], overrides)
        if code:
            out.setdefault(code, f["properties"]["NAME"])
    return out


@dataclass
class MapStore:
    data: dict[str, Any]
    ne_names: dict[str, str]

    @classmethod
    def load(cls, path: Path) -> MapStore | None:
        if not path.exists():
            return None
        return cls(json.loads(path.read_text()), natural_earth_names())

    @property
    def known(self) -> set[str]:
        return set(self.data["countries"]) | set(self.ne_names)

    @property
    def as_of(self) -> str:
        return str(self.data["as_of"])


def _pct_range(r: dict[str, Any]) -> tuple[float, float]:
    """(smaller loss, larger loss) as positive percents from a negative-is-loss row."""
    a, b = -r["hi"], -r["lo"]
    return min(a, b), max(a, b)


def headline(status: str, cost: dict[str, Any] | None) -> str:
    if status == "unknown" or cost is None or cost["value"] is None:
        return "There is not enough data to estimate the cost of conflict here."
    if status == "calm":
        return "No significant political violence was recorded in the last 12 months."
    small, large = _pct_range(cost)
    if status == "low_level" and large < 1:
        return (
            "Violence is at a low level. If it continued five years, the estimated cost is "
            "under 1% of GDP per person."
        )
    if small < 0:  # range includes no loss
        return (
            f"If current fighting continues five years, GDP per person could be up to "
            f"{large:.0f}% lower than without war, though the range includes no loss."
        )
    return (
        f"If current fighting continues five years, GDP per person is likely "
        f"{small:.0f}-{large:.0f}% lower than without war."
    )


def summary_warnings(store: MapStore, iso3: str, rows: dict[str, dict[str, Any]]) -> list[Warn]:
    out: list[Warn] = []
    c = store.data["countries"].get(iso3, {})
    cost = rows.get("cost_continue_h5", {})
    if cost.get("confidence") == "low" and cost.get("value") is not None:
        out.append(
            Warn(
                code="WIDE_RANGE",
                message="These estimates are uncertain: the likely "
                "range is wider than the estimate itself.",
                severity="info",
            )
        )
    start = c.get("acled_coverage_start")
    if start and int(store.as_of[:4]) - int(start[:4]) < 3:
        out.append(
            Warn(
                code="SHORT_ACLED_COVERAGE",
                message=f"Conflict records for this "
                f"country only start in {start[:4]}, so recent trends are less reliable.",
            )
        )
    poor = rows.get("extra_poor_h5", {})
    if poor.get("note", "").startswith("poverty survey too old"):
        out.append(
            Warn(
                code="STALE_POVERTY_DATA",
                message=f"Poverty impact is not shown: the "
                f"latest survey is too old ({poor['note'][-5:-1]}).",
            )
        )
    if c.get("status") in ("at_war", "low_level"):
        conv = store.data["conversion"]
        out.append(
            Warn(
                code="CONVERTED_DEATHS",
                severity="info",
                message=(
                    "Conflict deaths are converted from ACLED to the model's scale "
                    f"(x{conv['factor']:.2f}), "
                    f"calibrated mostly on African wars ({conv['africa_share']:.0%} of "
                    f"{conv['n_country_years']} country-years)."
                ),
            )
        )
    return out


def register(
    app: FastAPI,
    get_store: Callable[[], MapStore | None],
    make_meta: Callable[[], Meta],
    get_name: Callable[[str], str],
    artifacts_dir: Callable[[], Path],
) -> None:
    responses = {404: {"model": ErrorBody}, 503: {"model": ErrorBody}}

    def store_or_503() -> MapStore:
        s = get_store()
        if s is None:
            raise HTTPException(503, "map metrics missing; run `python -m conflict_sim.metrics`")
        return s

    @app.get("/findings", response_model=Envelope[Findings], responses=responses)
    def findings() -> Envelope[Findings]:
        """Generated findings for the scrolling page (python -m conflict_sim.findings)."""
        path = artifacts_dir() / "findings.json"
        if not path.exists():
            raise HTTPException(503, "findings missing; run `python -m conflict_sim.findings`")
        data = Findings.model_validate(json.loads(path.read_text()))
        return Envelope(data=data, coverage={}, warnings=[], meta=make_meta())

    @app.get("/map/metrics", response_model=Envelope[list[MetricInfo]], responses=responses)
    def map_metrics() -> Envelope[list[MetricInfo]]:
        s = store_or_503()
        data = [MetricInfo(name=k, **v) for k, v in s.data["catalog"].items()]
        return Envelope(data=data, coverage={}, warnings=[], meta=make_meta())

    @app.get("/map", response_model=Envelope[dict[str, MapValue]], responses=responses)
    def map_layer(
        metric: str = Query(..., examples=["intensity_12m"]),
    ) -> Envelope[dict[str, MapValue]]:
        s = store_or_503()
        if metric not in s.data["metrics"]:
            raise HTTPException(404, f"unknown metric {metric!r}; see /map/metrics")
        rows = s.data["metrics"][metric]
        data = {i: MapValue.model_validate(r) for i, r in rows.items()}
        return Envelope(data=data, coverage={}, warnings=[], meta=make_meta())

    @app.get(
        "/country/{iso3}/summary", response_model=Envelope[CountrySummary], responses=responses
    )
    def country_summary(iso3: str) -> Envelope[CountrySummary]:
        s = store_or_503()
        iso3 = iso3.upper()
        if iso3 not in s.known:
            raise HTTPException(
                404,
                f"unknown country code {iso3!r}: expected an ISO 3166 "
                "alpha-3 code such as KEN or UKR",
            )
        c = s.data["countries"].get(iso3)
        rows = {m: v[iso3] for m, v in s.data["metrics"].items() if iso3 in v}
        if c is None:  # on the map but no data at all
            empty = {
                "value": None,
                "lo": None,
                "hi": None,
                "confidence": "none",
                "as_of": s.as_of,
                "inputs": {},
                "note": "no data",
            }
            rows = {m: empty for m in s.data["catalog"]}
            c = {
                "name": s.ne_names.get(iso3, get_name(iso3)),
                "population": None,
                "status": "unknown",
                "fatalities_36m": [],
            }
        # badge follows the headline number (cost if fighting continues), else intensity
        lead = next(
            (
                rows[m]
                for m in ("cost_continue_h5", "intensity_12m")
                if m in rows and rows[m]["value"] is not None
            ),
            None,
        )
        overall = "none" if lead is None else lead["confidence"]
        summary = CountrySummary(
            iso3=iso3,
            name=c["name"] if c["name"] != iso3 else s.ne_names.get(iso3, get_name(iso3)),
            population=c["population"],
            status=c["status"],
            as_of=s.as_of,
            confidence=overall,
            headline=headline(c["status"], rows.get("cost_continue_h5")),
            metrics={m: MetricRow.model_validate(r) for m, r in rows.items()},
            fatalities_36m=[FatalityPoint.model_validate(p) for p in c["fatalities_36m"]],
            sources=SOURCES,
        )
        return Envelope(
            data=summary, coverage={}, warnings=summary_warnings(s, iso3, rows), meta=make_meta()
        )
