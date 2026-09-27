# Better sources for conflict–development analysis

The World Bank API audit checked 24 candidate codes, their definitions, and non-null observations for 1960–2025. Twenty returned data; four legacy codes returned API errors. Full responses, the WDI catalog, source catalog, and country/year coverage are saved here. Existing `data/` files and their metadata were not edited. This is a source audit, not a new model run.

## Recommended analysis inputs

| Role | Indicator/source | Verified coverage | Why use it / limitation |
|---|---|---|---|
| Primary conflict measure | Direct UCDP OrganizedViolenceCY v26.1 | Global country-year coverage 1989–2025, according to its codebook | Better basis for consistent historical aggregation than expanding regional event reporting. Separates state-based, non-state and one-sided violence; provides documented zero coding and low/best/high estimates. |
| World Bank conflict cross-check | `VC.BTL.DETH` | Non-null observations 1989–2024; **no WLD observations**; 41 countries with values in 2024 | UCDP-sourced battle deaths, a narrower measure than all political violence. Do not automatically turn missing API values into zero. |
| Primary economic outcome | `NY.GDP.PCAP.KD` | WLD 1960–2025, 66 consecutive observations | Real GDP per capita in constant 2015 US dollars, preferable to current-US-dollar GDP for historical growth. Use annual log changes. |
| Alternative growth outcome | `NY.GDP.PCAP.KD.ZG` | WLD 1961–2025, 65 consecutive observations | Published real GDP-per-capita annual growth. An alternative to log changes, not an independent outcome to count as separate corroboration. |
| Household welfare outcome | `NE.CON.PRVT.PC.KD` | WLD 1970–2024, 55 consecutive observations | Real household/NPISH final consumption per capita. Adds a long welfare-related outcome but does not measure the distribution of consumption or poverty. |
| Longer displacement-related outcome | `SM.POP.RHCR.EO` | WLD 1960–2025, 66 consecutive observations | UNHCR refugees by origin. Far longer than FDIP (2010–2025) or IDPC (2009–2025); a narrower population, not a replacement measuring all forced displacement. UNRWA refugees are generally excluded. |
| Destination-country displacement | `SM.POP.RHCR.EA` | WLD 1960–2025, 66 consecutive observations | Use asylum-country counts for effects on receiving countries. Do not add origin and asylum counts together: they describe the same population along different dimensions. |
| Economic vulnerability alternative | `SL.EMP.VULN.ZS` | WLD 1991–2025, 35 consecutive observations | Modeled ILO vulnerable-employment share. Useful if labor-market vulnerability is of interest, but a different concept from the old $4–10/day income headcount. |
| Broader poverty outcomes | `SI.POV.LMIC`, `SI.POV.UMIC`, `SI.POV.GAPS` | WLD 1981–2024, 43 observations; **2019 missing** for each | $4.20/day and $8.30/day headcounts, and $3/day poverty gap (2021 PPP). Better aligned with current poverty definitions, but do not solve annual coverage limitations. |
| Population denominator | `SP.POP.TOTL` | WLD 1960–2025, 66 consecutive observations | Convert conflict deaths to deaths per 100,000 people, using matching geography and year. |

World coverage above is measured from API responses, not inferred from the earliest observation in any country. Complete WLD coverage does not guarantee a consistent country reporting sample or unchanged definitions. Country-level non-null coverage counts are in `coverage_audit.csv` and `coverage_by_year/`.

## Best next model specification

1. Join UCDP organized-violence deaths to real GDP per capita, real consumption per capita, UNHCR refugees by origin, and population.
2. For a single world series, use 1989–2024 as the common window for those four outcomes/denominator; consumption's world aggregate ends in 2024. GDP and refugees can also be examined through 2025. Use geography-consistent aggregation rather than summing World Bank region and country rows together.
3. For a country-year panel, join country identifiers explicitly, retain the distinction between missing values and documented UCDP zeros, and audit country borders/reporting changes. Use rates as well as counts. A panel retains variation hidden by world aggregation, but still requires assumptions to interpret relationships.
4. Keep ARIMA/ARIMAX models small: even 1989–2024 supplies only 36 annual levels. Predefine lags and use rolling evaluation and corrections for multiple comparisons. Select sources for measurement and coverage, not whichever produces the largest correlation.

## What does not solve the existing limitations

- `VC.IDP.NWCV` is directly about conflict/violence displacement **incidents**, so repeated displacement of the same person can be counted more than once. Its observed API coverage is only 2009–2023, with no WLD observations; it is a useful country-level complementary outcome, not a longer global series.
- Existing FDIP and IDPC series remain useful for their specific concepts, but their short histories remain short. Refugees are a narrower outcome with longer history.
- `SI.POV.DDAY`, `SI.POV.LMIC`, `SI.POV.UMIC`, and `SI.POV.GAPS` share the missing 2019 world value in the API snapshot. Poverty and Inequality Platform (PIP) is the preferable upstream source for versioned poverty data and survey/line-up distinctions. Annual regional/world estimates involve interpolation or extrapolation using national accounts; they are not independent annual surveys. The current PIP API was not separately downloaded in this audit.
- `BX.KLT.DINV.WD.GD.ZS` (FDI inflows as % of GDP) has WLD data for 1970–2025 if investment is an additional outcome of interest. It is unrelated to the folder named FDIP, which means forcibly displaced people.
- `SM.POP.REFG.OR`, `SM.POP.REFG`, `VC.IDP.TOCV`, and `PV.EST` returned “indicator not found; may have been deleted or archived” from the queried API endpoint. Use the verified current refugee codes above. This error alone is not proof that all historical versions of these indicators are unavailable.
- The API source catalog lists WDI as source 2 and WGI as source 3. Governance perception measures are not substitutes for conflict-event or fatality counts.

## Sources and endpoints

- [UCDP v26.1 country-year codebook](https://ucdp.uu.se/downloads/organizedviolencecy/UCDP_OrganizedViolenceCY_Codebook_261.pdf): global 1989–2025 coverage, all Gleditsch–Ward states, zero coding, variables and inclusion thresholds. Zero means no qualifying recorded fatalities under UCDP's rules, not proof of no violence.
- [UCDP downloads](https://ucdp.uu.se/downloads/index.html) and [UCDP API](https://ucdp.uu.se/apidocs/).
- [World Bank battle-deaths definition](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/VC.BTL.DETH).
- [Real GDP definition](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/NY.GDP.PCAP.KD).
- [Real consumption definition](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/NE.CON.PRVT.PC.KD).
- [Current refugee-origin API definition](https://api.worldbank.org/v2/indicator/SM.POP.RHCR.EO?format=json).
- [Conflict displacement definition](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/VC.IDP.NWCV).
- [PIP](https://pip.worldbank.org/) and [World Bank explanation of annual poverty estimates](https://datahelpdesk.worldbank.org/knowledgebase/articles/193313-if-poverty-rates-are-not-available-for-all-countri).

Example data request:

```text
https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.KD?source=2&date=1989:2025&format=json&per_page=20000
```

Use `country/WLD` for official world aggregates. Handle pagination and preserve `null` values. Exact queried endpoints are recorded in `coverage_audit.csv` and raw responses in `api_responses/`. The reproducible audit is `analysis/search_world_bank.py`; it reuses cached responses, so remove or relocate the audit cache deliberately when requesting a fresh vintage.
