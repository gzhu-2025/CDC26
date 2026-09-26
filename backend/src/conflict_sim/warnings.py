"""Machine-readable warnings shared by the simulator and the API (`warnings` field)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

Severity = Literal["info", "warning"]


class Warn(BaseModel):
    code: str
    message: str
    severity: Severity = "warning"

    @classmethod
    def short_gdp(cls, n: int, minimum: int) -> Warn:
        return cls(
            code="SHORT_GDP_HISTORY", message=f"country has {n} (<{minimum}) years of GDP data"
        )

    @classmethod
    def stale_anchor(cls, anchor: int, onset: int) -> Warn:
        return cls(
            code="BASELINE_EXTRAPOLATED",
            message=f"last GDP observation is {anchor}; "
            f"baseline extrapolated {onset - anchor} years",
        )

    @classmethod
    def few_peaceful_years(cls) -> Warn:
        return cls(
            code="FEW_PEACEFUL_YEARS",
            message="fewer than 3 peaceful years in the baseline window; trend uses all years",
        )

    @classmethod
    def no_data(cls, what: str) -> Warn:
        return cls(
            code=f"NO_{what.upper()}_DATA", message=f"no {what} data before onset; {what} omitted"
        )

    @classmethod
    def stale_poverty(cls, year: int) -> Warn:
        return cls(code="STALE_POVERTY_DATA", message=f"latest poverty survey is from {year}")

    @classmethod
    def poverty_floor(cls) -> Warn:
        return cls(
            code="POVERTY_FLOOR",
            message="observed poverty rate is 0; floored at 0.1% for the log model",
        )

    @classmethod
    def pretrend(cls, outcome: str, measure: str, h: int, p: float) -> Warn:
        return cls(
            code="PRETREND_SIGNIFICANT",
            message=f"{outcome} pre-trend lead h={h} ({measure}) significant at 5% (p={p:.3f})",
        )

    @classmethod
    def extrapolated_intensity(cls, value: float, p99: float) -> Warn:
        return cls(
            code="INTENSITY_OUT_OF_SAMPLE",
            message=f"intensity {value:g}/100k exceeds the 99th percentile of conflict years in "
            f"the estimation sample ({p99:.1f}/100k); effects are extrapolated",
        )

    @classmethod
    def arima_fallback(cls, min_obs: int) -> Warn:
        return cls(
            code="BASELINE_TREND_FALLBACK",
            message=f"fewer than {min_obs} consecutive years of GDP data; the no-war path uses "
            "a simple trend instead of ARIMA",
            severity="info",
        )

    @classmethod
    def currently_at_war(cls, year: int) -> Warn:
        return cls(
            code="CURRENTLY_AT_WAR",
            message=f"country was already in conflict in {year}; the scenario shows the added "
            "cost of a new war of this size (set continue_existing_war to extend it instead)",
            severity="info",
        )

    @classmethod
    def already_at_war(cls, year: int, war_year: int) -> Warn:
        return cls(
            code="ALREADY_AT_WAR",
            message=f"country was already in conflict in {year}; the simulated war continues "
            f"it (starting at year {war_year} of the war)",
            severity="info",
        )

    @classmethod
    def synthetic(cls) -> Warn:
        return cls(
            code="SYNTHETIC_ESTIMATES",
            message="estimates were fitted on the synthetic test fixture, not real data",
        )

    @classmethod
    def sanity(cls, gap: float, band: tuple[float, float]) -> Warn:
        return cls(
            code="SANITY_BAND",
            message=f"reference scenario GDP gap {gap:.1%} is outside the expected band "
            f"[{band[0]:.0%}, {band[1]:.0%}]",
            severity="info",
        )
