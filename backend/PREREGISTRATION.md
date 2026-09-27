# Pre-registration: does war hurt some economies more?

**Registered:** 2026-09-26, committed to git before any heterogeneity model was estimated or
evaluated. Changes after this date are appended as dated amendments below; nothing above the
amendments section is edited.

## Question

Does the GDP-per-capita cost of conflict differ systematically across countries in a way that
improves out-of-sample predictions over the pooled (one-size-fits-all) model?

## Reference model (pooled)

The current engine (`config.yaml` at this commit): local projections of log GDP per capita on
x = log1p(battle deaths per 100k / 10), with the long-war term (x · log1p(years into the war)),
the neighbor-spillover term, 8 years of past-conflict controls, future-shock controls, country
and year fixed effects. No-war path: per-country ARIMA(p,1,q) with drift.

## Evaluation design (identical for all models)

- **Wars:** the 29 backtest episodes from `conflict_sim.backtest.select_episodes` (onset ≥ 1995,
  mean intensity ≥ 2 deaths per 100k, ≥ 3 years of outcome data), fixed by this commit.
- **Held out:** for each war, the war country's GDP outcomes are removed from estimation
  (whole country held out); the model is re-estimated and the war predicted from data before
  its start (`conflict_sim.lowo`).
- **Estimation:** GDP only, 200 cluster-bootstrap draws, seed from `config.yaml`.
- **Prediction:** median of the simulated with-war path at the last observed horizon (≤ 10 years);
  90% range = 5th to 95th percentile, **before** any band calibration.

## Candidates

1. **Economic-structure interactions.** Add x · z terms (with the same past/future controls as
   x) for two country characteristics measured in the year before the war began (the year
   before the current episode's first conflict year; for non-war years, the previous year):
   - natural resource rents, % of GDP (World Bank `NY.GDP.TOTL.RT.ZS`);
   - net official development assistance received, % of GNI (`DT.ODA.ODAT.GN.ZS`).
   Each is standardized over the estimation sample; missing values are set to the sample mean
   (0 after standardizing).
2. **Regional empirical-Bayes shrinkage.** Estimate region-specific effect paths (x interacted
   with World Bank region), then shrink each region's deviation from the pooled path toward
   zero by tau² / (tau² + se²), where se² is the region's bootstrap variance and tau² the
   between-region variance (method of moments, floored at 0), per horizon.

## Pass rule

A candidate **passes** only if both hold on the same 29 held-out wars:

1. **Wins on ≥ 20 of 29 wars**, where a win means the candidate's absolute log error of the
   median prediction is smaller than the pooled model's on that war. A war the candidate
   cannot simulate counts as a loss.
2. **Coverage closer to 90%:** |coverage₉₀(candidate) − 0.90| < |coverage₉₀(pooled) − 0.90|.

If both candidates pass, the one with more wins is reported (ties: fewer parameters, i.e.
candidate 1). If none passes, the site states that the data cannot yet tell economies apart
reliably, and the pooled model stays in use.

## Reporting commitment

The findings page (§6) reports the outcome of this test whichever way it goes, generated from
`artifacts/lowo/` without manual editing.

## Notes

- The pooled leave-one-war-out run was started shortly before this file was committed. It
  contains no heterogeneity model and does not inform the candidates above.

## Amendments

**2026-09-26, before any candidate was run (implementation details only; candidates and
pass rule unchanged):**
- Candidate 2's "pooled path" is operationalized as the precision-weighted mean of the
  regional paths from the same regional model (so each fold needs one estimation); regions
  are the World Bank regions from the country metadata, coded as x-by-region interactions with
  the largest region as reference. Countries without a region use the reference path.
- Candidate 1's standardized covariates enter the prediction for a held-out war at their value
  in the year before that war's start year.
