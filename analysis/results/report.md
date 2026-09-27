# Conflict and indicator time-series analysis

Darts ARIMA/ARIMAX models were fitted to annual changes, with descriptive level and change correlations. These are exploratory associations, not causal effects or reliable estimates of worldwide conflict impacts.

## Findings

0 coefficients using the expanding reported-country totals pass the multiple-comparison correction. Coverage changes, short samples and aggregation prevent a strong global conclusion. Strong raw-level correlations should be compared with the much weaker annual-change correlations in the table below.

fixed_cohort: events and IDPC, lag 1, standardized beta 0.664, q = 0.0103, n = 16. Adding conflict changes held-out MAE by +44.0% across 4 test years (positive means worse).

Statistical associations alone do not establish dependable predictive evidence. Forecast comparisons use very few test years and should be treated as exploratory.

## Data and coverage

- Use World Bank WLD rows for GDP per capita (current US dollars), forcibly displaced people (FDIP), internally displaced people (IDPC), and poverty at $3/day (2021 PPP). FDIP is not foreign direct investment.
- Use the country-month political-violence events workbook and country-year reported-fatalities workbook. Annual sums are sums of reported rows. Regional weekly workbooks overlap those sources and are not added again; their mix of demonstrations and other events also differs from political violence.
- Exclude partial 2026. Conflict totals cover changing geographies: 48 countries/territories in 1997, over 200 recently (fatalities). Missing reporting is not interpreted as zero.
- `reported` uses all reported countries, not a historically consistent global total. `fixed_cohort` uses the same 46 African countries with rows in every year 1997–2025; it is a coverage sensitivity check against world indicators, not a world conflict series. It does not remove changes in reporting intensity or country boundaries.
- `recent_2020_plus` restricts both endpoints of changes to 2020 onward; even this window has varying coverage. It has too few annual observations for the prespecified model minimum of 12.
- Vulnerable contains regional/country data only, 2000–2014, with no WLD series. Its Latin America coverage does not overlap the Latin America conflict data starting in 2018; no global model is fabricated.
- Poverty has a missing world observation in 2019. Correlations omit missing pairs; ARIMA uses the longest uninterrupted run (through 2018), with no interpolation or stitching across the gap.

## Method

1. GDP and displacement: 100 × change in log(value); poverty: percentage-point changes. Conflict: 100 × change in log(1 + count). Raw-level correlations are descriptive and may largely reflect trends.
2. Test conflict changes at lags 0, 1, and 2 years against indicator changes. Positive lag means conflict occurs first. Correlations use every available pair; model sample dates and sizes are recorded separately.
3. Prespecified Darts ARIMA(1,0,0) with a constant on standardized annual changes; add one standardized conflict-change covariate for ARIMAX. This is ARIMA(1,1,0) on transformed levels. No seasonal terms or data-driven lag/order selection; annual samples are short. Darts' default 30-point minimum is explicitly lowered to 12 for this small exploratory model; short-sample inference remains fragile. Beta is indicator-change standard deviations per conflict-change standard deviation, conditional on AR(1) errors.
4. Report approximate model-based 95% intervals and p-values, Benjamini–Hochberg q-values across all converged ARIMAX fits, AIC change, convergence and residual Ljung–Box diagnostics. Small samples, residual misspecification, structural breaks and omitted variables limit inference; q-values do not correct those problems.
5. Lag-one predictive check: expanding training window, minimum 12 changes, up to five one-year holdouts; compare ARIMA and ARIMAX mean absolute error in original change units. Scaling uses each training fold only. Lag-one conflict is known at the forecast origin; lag-zero is an association analysis only. Revised historical data make this pseudo-out-of-sample, not a real-time publication-vintage test. No future scenarios are extrapolated.

## Same-year descriptive correlations

Reported totals have changing coverage; fixed cohort is African conflict vs world indicators.

| Indicator | Conflict measure | Reported level r | Reported change r (n) | Fixed-cohort change r (n) |
|---|---|---:|---:|---:|
| GDP | events | 0.801 | 0.108 (28) | 0.157 (28) |
| GDP | fatalities | 0.673 | -0.147 (28) | -0.141 (28) |
| FDIP | events | 0.953 | 0.089 (15) | 0.052 (15) |
| FDIP | fatalities | 0.903 | -0.092 (15) | 0.097 (15) |
| IDPC | events | 0.935 | -0.197 (16) | 0.192 (16) |
| IDPC | fatalities | 0.890 | -0.218 (16) | 0.166 (16) |
| Poverty | events | -0.699 | 0.023 (25) | -0.001 (25) |
| Poverty | fatalities | -0.585 | 0.281 (25) | 0.247 (25) |

## ARIMAX results passing exploratory FDR threshold

Threshold q < 0.05 across all converged model coefficients. Intervals and q-values are approximate; surviving results still cannot resolve coverage bias or establish causation.

| Scope | Indicator | Conflict | Lag | Years (n) | Standardized beta [95% CI] | q |
|---|---|---|---:|---|---:|---:|
| fixed_cohort | IDPC | events | 1 | 2010–2025 (16) | 0.664 [0.312, 1.015] | 0.0103 |

## Lag-one rolling forecast comparison

Positive improvement means lower MAE with conflict. At most five test years: descriptive, not evidence of stable forecasting gains.

| Scope | Indicator | Conflict | Test years | Folds | ARIMA MAE | ARIMAX MAE | Improvement |
|---|---|---|---|---:|---:|---:|---:|
| fixed_cohort | FDIP | events | 2023–2025 | 3 | 5.622 | 5.348 | 4.9% |
| fixed_cohort | GDP | events | 2021–2025 | 5 | 3.036 | 2.969 | 2.2% |
| fixed_cohort | IDPC | events | 2022–2025 | 4 | 6.240 | 8.988 | -44.0% |
| fixed_cohort | Poverty | events | 2014–2018 | 5 | 0.529 | 0.497 | 6.1% |
| fixed_cohort | FDIP | fatalities | 2023–2025 | 3 | 5.622 | 5.127 | 8.8% |
| fixed_cohort | GDP | fatalities | 2021–2025 | 5 | 3.036 | 3.063 | -0.9% |
| fixed_cohort | IDPC | fatalities | 2022–2025 | 4 | 6.240 | 5.796 | 7.1% |
| fixed_cohort | Poverty | fatalities | 2014–2018 | 5 | 0.529 | 0.539 | -1.8% |
| reported | FDIP | events | 2023–2025 | 3 | 5.622 | 6.111 | -8.7% |
| reported | GDP | events | 2021–2025 | 5 | 3.036 | 3.180 | -4.7% |
| reported | IDPC | events | 2022–2025 | 4 | 6.240 | 5.931 | 5.0% |
| reported | Poverty | events | 2014–2018 | 5 | 0.529 | 0.468 | 11.7% |
| reported | FDIP | fatalities | 2023–2025 | 3 | 5.622 | 5.567 | 1.0% |
| reported | GDP | fatalities | 2021–2025 | 5 | 3.036 | 3.209 | -5.7% |
| reported | IDPC | fatalities | 2022–2025 | 4 | 6.240 | 6.262 | -0.4% |
| reported | Poverty | fatalities | 2014–2018 | 5 | 0.529 | 0.543 | -2.5% |

## Files and reproduction

Run `python analysis/conflict_indicators.py` after installing `analysis/requirements.txt`. Exact package versions and input SHA-256 hashes are in `manifest.json`. All original data, pickles, and metadata are verified unchanged.

- `annual_levels.csv` / `.pkl`, `annual_changes.csv`: aligned inputs; gaps retained.
- `correlations.csv`: all scopes, indicators, metrics and lags.
- `arimax_results.csv`: coefficients, confidence intervals, p/q-values, diagnostics and explicit skips.
- `backtest_predictions.csv`, `backtest_scores.csv`: held-out predictions and error comparisons.
- `models/`: fitted Darts models and scaling metadata, one per eligible combination.
- `conflict_coverage.csv`, `fixed_cohort_countries.json`, `indicator_inventory.csv`: sample audit.
- `correlation_overview.png`: coverage and change-correlation figure.

Model API reference: [Darts ARIMA documentation](https://unit8co.github.io/darts/generated_api/darts.models.forecasting.arima.html). Darts wraps statsmodels ARIMA and accepts external regressors through future covariates.
