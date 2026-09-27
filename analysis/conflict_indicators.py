"""Reproducible exploratory global conflict analysis using Darts ARIMA.

Run: python analysis/conflict_indicators.py
Only analysis/results is written; data and metadata are read-only inputs.
"""

from pathlib import Path
import hashlib
import importlib.metadata
import json
import os
import warnings

os.environ.setdefault("MPLCONFIGDIR", "/private/tmp/cdc26-mpl")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from darts import TimeSeries
from darts.models import ARIMA
from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.stats.multitest import multipletests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = Path(__file__).resolve().parent / "results"
YEARS = pd.date_range("1997-01-01", "2025-01-01", freq="YS", name="date")
INDICATORS = ["GDP", "FDIP", "IDPC", "Poverty"]
MIN_OBS = 12


def hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(DATA.rglob("*")) if p.is_file()}


def longest_run(frame):
    """Keep the longest complete annual run; never collapse gaps or interpolate."""
    valid = frame.notna().all(axis=1)
    runs = [g for _, g in frame.groupby((~valid).cumsum()) if len(g.dropna())]
    return max((g.dropna() for g in runs), key=len, default=frame.iloc[:0])


def load_data():
    levels = pd.DataFrame(index=YEARS)
    coverage, inventory, cohorts = [], [], {}
    for folder in INDICATORS + ["Vulnerable"]:
        path = next((DATA / folder).glob("*.pkl"))
        frame = pd.read_pickle(path)
        world = frame.loc[frame["Country Code"].eq("WLD"), "value"]
        assert not world.index.duplicated().any()
        if folder in INDICATORS:
            levels[folder] = world.reindex(YEARS)
        inventory.append({"indicator": folder, "name": frame["Indicator Name"].iloc[0],
                          "source": str(path.relative_to(ROOT)),
                          "world_observations": int(world.notna().sum()),
                          "world_first_year": int(world.dropna().index.year.min()) if world.notna().any() else None,
                          "world_last_year": int(world.dropna().index.year.max()) if world.notna().any() else None,
                          "status": "included" if folder in INDICATORS else
                          "excluded: no world aggregate; regional data end in 2014 before regional conflict coverage"})
    for metric, pattern, value in [
        ("events", "number_of_political*.pkl", "EVENTS"),
        ("fatalities", "number_of_reported*.pkl", "FATALITIES"),
    ]:
        frame = pd.read_pickle(next((DATA / "Conflict").glob(pattern)))
        keys = ["COUNTRY", "YEAR"] + (["MONTH"] if "MONTH" in frame else [])
        assert not frame.duplicated(keys).any()
        frame = frame[frame.YEAR.between(1997, 2025)].copy()
        assert frame[value].notna().all() and frame[value].ge(0).all()
        by_year = frame.groupby("YEAR")
        country_sets = by_year.COUNTRY.agg(set)
        cohort = set.intersection(*country_sets)
        cohorts[metric] = sorted(cohort)
        for year, group in by_year:
            coverage.append({"metric": metric, "year": int(year),
                             "countries_with_rows": group.COUNTRY.nunique(),
                             "rows": len(group), "fixed_cohort_countries": len(cohort)})
        for scope, part in [("reported", frame),
                            ("fixed_cohort", frame[frame.COUNTRY.isin(cohort)])]:
            annual = part.groupby("YEAR")[value].sum(min_count=1)
            annual.index = pd.to_datetime(annual.index.astype(str), format="%Y")
            levels[f"{scope}_{metric}"] = annual.reindex(YEARS)
    pd.DataFrame(inventory).to_csv(OUT / "indicator_inventory.csv", index=False)
    pd.DataFrame(coverage).to_csv(OUT / "conflict_coverage.csv", index=False)
    (OUT / "fixed_cohort_countries.json").write_text(json.dumps(cohorts, indent=2))
    return levels, pd.DataFrame(coverage)


def changes(levels):
    # GDP/displacement: 100 * annual log changes. Poverty: percentage points.
    result = levels.copy()
    for col in result:
        if col == "Poverty":
            result[col] = levels[col].diff()
        elif col in INDICATORS:
            assert levels[col].dropna().gt(0).all()
            result[col] = 100 * np.log(levels[col]).diff()
        else:
            result[col] = 100 * np.log1p(levels[col]).diff()
    return result


def to_darts(s):
    return TimeSeries.from_series(s.astype(float), freq="YS")


def fit_arima(y, x=None):
    # First differences are constructed explicitly, so d=0 here. The model
    # is ARIMA(1,1,0) on transformed levels, with conflict-change regression.
    model = ARIMA(p=1, d=0, q=0, trend="c", min_train_length=MIN_OBS)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        model.fit(to_darts(y), future_covariates=to_darts(x) if x is not None else None)
    converged = bool(model.model.mle_retvals.get("converged", True))
    return model, converged, sorted({str(w.message) for w in caught})


def standardize(frame):
    mean, scale = frame.mean(), frame.std(ddof=0)
    if not scale.gt(0).all():
        raise ValueError("Constant series cannot be standardized")
    return (frame - mean) / scale, mean, scale


def backtest(frame, labels):
    """Expanding one-year-ahead forecasts, lag-one conflict known at origin.

    Training-only scaling. Fixed prespecified order; no holdout model selection.
    Vintage data are unavailable, so this is pseudo-out-of-sample, not real-time.
    """
    rows = []
    for end in range(max(MIN_OBS, len(frame) - 5), len(frame)):
        train = frame.iloc[:end]
        standardized, mean, scale = standardize(train)
        baseline, ok_b, _ = fit_arima(standardized.y)
        augmented, ok_a, _ = fit_arima(standardized.y, standardized.x)
        future_x = (frame.x.iloc[:end + 1] - mean.x) / scale.x
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            b = float(baseline.predict(1).values()[0, 0]) * scale.y + mean.y
            a = float(augmented.predict(1, future_covariates=to_darts(future_x)).values()[0, 0]) * scale.y + mean.y
        rows.append({**labels, "year": frame.index[end].year,
                     "actual_change": frame.y.iloc[end], "arima_prediction": b,
                     "arimax_prediction": a, "training_observations": end,
                     "converged": ok_a and ok_b})
    return rows


def analyze(levels, delta):
    correlations, models, predictions, failures = [], [], [], []
    for scope in ["reported", "fixed_cohort", "recent_2020_plus"]:
        for metric in ["events", "fatalities"]:
            conflict = f"{'reported' if scope == 'recent_2020_plus' else scope}_{metric}"
            for indicator in INDICATORS:
                for lag in [0, 1, 2]:
                    labels = dict(scope=scope, metric=metric, indicator=indicator, lag_years=lag)
                    raw = pd.DataFrame({"y": levels[indicator], "x": levels[conflict].shift(lag)})
                    pair = pd.DataFrame({"y": delta[indicator], "x": delta[conflict].shift(lag)})
                    if scope == "recent_2020_plus":
                        # Both endpoints of the change and its lag must be >= 2020.
                        raw = raw.loc[str(2020 + lag):]
                        pair = pair.loc[str(2021 + lag):]
                    clean = pair.dropna()
                    correlations.append({**labels, "level_n": len(raw.dropna()),
                                         "level_pearson_r": raw.corr().loc["y", "x"],
                                         "change_n": len(clean),
                                         "change_pearson_r": clean.corr().loc["y", "x"],
                                         "change_spearman_r": clean.corr(method="spearman").loc["y", "x"]})
                    frame = longest_run(pair)
                    entry = {**labels, "n": len(frame),
                             "start_year": int(frame.index.year.min()) if len(frame) else None,
                             "end_year": int(frame.index.year.max()) if len(frame) else None}
                    if len(frame) < MIN_OBS:
                        models.append({**entry, "status": "insufficient contiguous observations"})
                        continue
                    try:
                        z, mean, scale = standardize(frame)
                        base, ok_b, warn_b = fit_arima(z.y)
                        model, ok_a, warn_a = fit_arima(z.y, z.x)
                        res = model.model
                        names = res.param_names
                        exog = names.index("x1")
                        ci = np.asarray(res.conf_int())[exog]
                        lb = acorr_ljungbox(np.asarray(res.resid)[1:], lags=[min(4, len(frame)//4)], model_df=1)
                        entry.update(status="ok" if ok_a and ok_b else "nonconverged",
                                     beta_standardized=float(res.params[exog]),
                                     ci95_lower=float(ci[0]), ci95_upper=float(ci[1]),
                                     p_value=float(res.pvalues[exog]),
                                     arima_aic=float(base.model.aic), arimax_aic=float(res.aic),
                                     aic_improvement=float(base.model.aic-res.aic),
                                     residual_ljung_box_p=float(lb.lb_pvalue.iloc[0]),
                                     warnings="; ".join(warn_b + warn_a))
                        stem = f"{scope}_{metric}_{indicator}_lag{lag}"
                        model.save(str(OUT / "models" / f"{stem}.pkl"))
                        (OUT / "models" / f"{stem}.json").write_text(json.dumps({
                            **labels, "y_mean": mean.y, "y_scale": scale.y,
                            "x_mean": mean.x, "x_scale": scale.x,
                            "model": "ARIMA(1,0,0) with constant on standardized annual changes",
                        }, indent=2))
                        if lag == 1:
                            predictions.extend(backtest(frame, labels))
                    except (ValueError, RuntimeError, np.linalg.LinAlgError) as exc:
                        entry.update(status="failed", error=str(exc))
                        failures.append({**labels, "error": str(exc)})
                    models.append(entry)
                print(f"Completed {scope}: {metric} / {indicator}", flush=True)
    corr, fits, pred = pd.DataFrame(correlations), pd.DataFrame(models), pd.DataFrame(predictions)
    fits["q_value_bh"] = np.nan
    if "p_value" not in fits:
        fits["p_value"] = np.nan
    valid = fits.status.eq("ok") & fits.p_value.notna()
    if valid.any():
        fits.loc[valid, "q_value_bh"] = multipletests(fits.loc[valid, "p_value"], method="fdr_bh")[1]
    scores = []
    for labels, part in (pred.groupby(["scope", "metric", "indicator", "lag_years"]) if len(pred) else []):
        b = np.mean(np.abs(part.actual_change-part.arima_prediction))
        a = np.mean(np.abs(part.actual_change-part.arimax_prediction))
        scores.append(dict(zip(["scope", "metric", "indicator", "lag_years"], labels)) |
                      {"folds": len(part), "first_test_year": int(part.year.min()),
                       "last_test_year": int(part.year.max()), "arima_mae": b, "arimax_mae": a,
                       "mae_improvement_percent": 100*(b-a)/b,
                       "all_converged": bool(part.converged.all())})
    score = pd.DataFrame(scores)
    for name, frame in [("correlations", corr), ("arimax_results", fits),
                        ("backtest_predictions", pred), ("backtest_scores", score)]:
        frame.to_csv(OUT / f"{name}.csv", index=False)
    (OUT / "failures.json").write_text(json.dumps(failures, indent=2))
    return corr, fits, score


def plot_results(levels, coverage, corr):
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), layout="constrained")
    for metric, group in coverage.groupby("metric"):
        axes[0].plot(group.year, group.countries_with_rows, label=metric)
    axes[0].set(title="Conflict coverage changes over time", xlabel="Year", ylabel="Countries / territories with rows")
    axes[0].legend()
    for i, scope in enumerate(["reported", "fixed_cohort"]):
        sub = corr[corr.scope.eq(scope) & corr.metric.eq("events") & corr.lag_years.eq(0)].set_index("indicator").reindex(INDICATORS)
        axes[1].bar(np.arange(4) + (i-.5)*.36, sub.change_pearson_r, width=.36,
                    label="Expanding reporting" if i == 0 else "Fixed 46-country cohort")
    axes[1].set(xticks=np.arange(4), xticklabels=INDICATORS, ylim=(-1, 1),
                title="Conflict events vs annual indicator changes", ylabel="Descriptive Pearson correlation")
    axes[1].axhline(0, color="black", linewidth=.6)
    axes[1].legend(fontsize=8)
    fig.savefig(OUT / "correlation_overview.png", dpi=180)
    plt.close(fig)


def report(corr, fits, scores):
    significant = fits[fits.status.eq("ok") & fits.q_value_bh.lt(.05)]
    reported_count = int(significant.scope.eq("reported").sum())
    findings = (f"{reported_count} coefficients using the expanding reported-country totals pass "
                "the multiple-comparison correction. Coverage changes, short samples and aggregation "
                "prevent a strong global conclusion. Strong raw-level correlations should be compared "
                "with the much weaker annual-change correlations in the table below.")
    checks = []
    for r in significant.itertuples():
        check = scores[(scores.scope == r.scope) & (scores.indicator == r.indicator) &
                       (scores.metric == r.metric) & (scores.lag_years == r.lag_years)]
        text = (f"{r.scope}: {r.metric} and {r.indicator}, lag {r.lag_years}, "
                f"standardized beta {r.beta_standardized:.3f}, q = {r.q_value_bh:.4f}, n = {r.n}.")
        if len(check):
            s = check.iloc[0]
            text += (f" Adding conflict changes held-out MAE by {-s.mae_improvement_percent:+.1f}% "
                     f"across {int(s.folds)} test years (positive means worse).")
        checks.append(text)
    lines = ["# Conflict and indicator time-series analysis", "",
             "Darts ARIMA/ARIMAX models were fitted to annual changes, with descriptive level and change correlations. These are exploratory associations, not causal effects or reliable estimates of worldwide conflict impacts.", "",
             "## Findings", "",
             findings, "", *checks, "",
             "Statistical associations alone do not establish dependable predictive evidence. Forecast comparisons use very few test years and should be treated as exploratory.", "",
             "## Data and coverage", "",
             "- Use World Bank WLD rows for GDP per capita (current US dollars), forcibly displaced people (FDIP), internally displaced people (IDPC), and poverty at $3/day (2021 PPP). FDIP is not foreign direct investment.",
             "- Use the country-month political-violence events workbook and country-year reported-fatalities workbook. Annual sums are sums of reported rows. Regional weekly workbooks overlap those sources and are not added again; their mix of demonstrations and other events also differs from political violence.",
             "- Exclude partial 2026. Conflict totals cover changing geographies: 48 countries/territories in 1997, over 200 recently (fatalities). Missing reporting is not interpreted as zero.",
             "- `reported` uses all reported countries, not a historically consistent global total. `fixed_cohort` uses the same 46 African countries with rows in every year 1997–2025; it is a coverage sensitivity check against world indicators, not a world conflict series. It does not remove changes in reporting intensity or country boundaries.",
             "- `recent_2020_plus` restricts both endpoints of changes to 2020 onward; even this window has varying coverage. It has too few annual observations for the prespecified model minimum of 12.",
             "- Vulnerable contains regional/country data only, 2000–2014, with no WLD series. Its Latin America coverage does not overlap the Latin America conflict data starting in 2018; no global model is fabricated.",
             "- Poverty has a missing world observation in 2019. Correlations omit missing pairs; ARIMA uses the longest uninterrupted run (through 2018), with no interpolation or stitching across the gap.", "",
             "## Method", "",
             "1. GDP and displacement: 100 × change in log(value); poverty: percentage-point changes. Conflict: 100 × change in log(1 + count). Raw-level correlations are descriptive and may largely reflect trends.",
             "2. Test conflict changes at lags 0, 1, and 2 years against indicator changes. Positive lag means conflict occurs first. Correlations use every available pair; model sample dates and sizes are recorded separately.",
             "3. Prespecified Darts ARIMA(1,0,0) with a constant on standardized annual changes; add one standardized conflict-change covariate for ARIMAX. This is ARIMA(1,1,0) on transformed levels. No seasonal terms or data-driven lag/order selection; annual samples are short. Darts' default 30-point minimum is explicitly lowered to 12 for this small exploratory model; short-sample inference remains fragile. Beta is indicator-change standard deviations per conflict-change standard deviation, conditional on AR(1) errors.",
             "4. Report approximate model-based 95% intervals and p-values, Benjamini–Hochberg q-values across all converged ARIMAX fits, AIC change, convergence and residual Ljung–Box diagnostics. Small samples, residual misspecification, structural breaks and omitted variables limit inference; q-values do not correct those problems.",
             "5. Lag-one predictive check: expanding training window, minimum 12 changes, up to five one-year holdouts; compare ARIMA and ARIMAX mean absolute error in original change units. Scaling uses each training fold only. Lag-one conflict is known at the forecast origin; lag-zero is an association analysis only. Revised historical data make this pseudo-out-of-sample, not a real-time publication-vintage test. No future scenarios are extrapolated.", "",
             "## Same-year descriptive correlations", "",
             "Reported totals have changing coverage; fixed cohort is African conflict vs world indicators.", "",
             "| Indicator | Conflict measure | Reported level r | Reported change r (n) | Fixed-cohort change r (n) |",
             "|---|---|---:|---:|---:|"]
    for indicator in INDICATORS:
        for metric in ["events", "fatalities"]:
            sub = corr[corr.indicator.eq(indicator) & corr.metric.eq(metric) & corr.lag_years.eq(0)].set_index("scope")
            a, b = sub.loc["reported"], sub.loc["fixed_cohort"]
            lines.append(f"| {indicator} | {metric} | {a.level_pearson_r:.3f} | {a.change_pearson_r:.3f} ({int(a.change_n)}) | {b.change_pearson_r:.3f} ({int(b.change_n)}) |")
    lines += ["", "## ARIMAX results passing exploratory FDR threshold", "",
              "Threshold q < 0.05 across all converged model coefficients. Intervals and q-values are approximate; surviving results still cannot resolve coverage bias or establish causation.", "",
              "| Scope | Indicator | Conflict | Lag | Years (n) | Standardized beta [95% CI] | q |",
              "|---|---|---|---:|---|---:|---:|"]
    significant = fits[fits.status.eq("ok") & fits.q_value_bh.lt(.05)]
    for r in significant.itertuples():
        lines.append(f"| {r.scope} | {r.indicator} | {r.metric} | {r.lag_years} | {r.start_year:.0f}–{r.end_year:.0f} ({r.n}) | {r.beta_standardized:.3f} [{r.ci95_lower:.3f}, {r.ci95_upper:.3f}] | {r.q_value_bh:.4f} |")
    if significant.empty:
        lines.append("| No coefficients pass q < 0.05 | | | | | | |")
    lines += ["", "## Lag-one rolling forecast comparison", "",
              "Positive improvement means lower MAE with conflict. At most five test years: descriptive, not evidence of stable forecasting gains.", "",
              "| Scope | Indicator | Conflict | Test years | Folds | ARIMA MAE | ARIMAX MAE | Improvement |",
              "|---|---|---|---|---:|---:|---:|---:|"]
    for r in scores.itertuples():
        lines.append(f"| {r.scope} | {r.indicator} | {r.metric} | {r.first_test_year}–{r.last_test_year} | {r.folds} | {r.arima_mae:.3f} | {r.arimax_mae:.3f} | {r.mae_improvement_percent:.1f}% |")
    lines += ["", "## Files and reproduction", "",
              "Run `python analysis/conflict_indicators.py` after installing `analysis/requirements.txt`. Exact package versions and input SHA-256 hashes are in `manifest.json`. All original data, pickles, and metadata are verified unchanged.", "",
              "- `annual_levels.csv` / `.pkl`, `annual_changes.csv`: aligned inputs; gaps retained.",
              "- `correlations.csv`: all scopes, indicators, metrics and lags.",
              "- `arimax_results.csv`: coefficients, confidence intervals, p/q-values, diagnostics and explicit skips.",
              "- `backtest_predictions.csv`, `backtest_scores.csv`: held-out predictions and error comparisons.",
              "- `models/`: fitted Darts models and scaling metadata, one per eligible combination.",
              "- `conflict_coverage.csv`, `fixed_cohort_countries.json`, `indicator_inventory.csv`: sample audit.",
              "- `correlation_overview.png`: coverage and change-correlation figure.", "",
              "Model API reference: [Darts ARIMA documentation](https://unit8co.github.io/darts/generated_api/darts.models.forecasting.arima.html). Darts wraps statsmodels ARIMA and accepts external regressors through future covariates.", ""]
    (OUT / "report.md").write_text("\n".join(lines))


def main():
    (OUT / "models").mkdir(parents=True, exist_ok=True)
    before = hashes()
    levels, coverage = load_data()
    delta = changes(levels)
    levels.to_pickle(OUT / "annual_levels.pkl")
    levels.to_csv(OUT / "annual_levels.csv")
    delta.to_csv(OUT / "annual_changes.csv")
    corr, fits, scores = analyze(levels, delta)
    plot_results(levels, coverage, corr)
    report(corr, fits, scores)
    assert hashes() == before, "An input file changed during analysis"
    versions = {p: importlib.metadata.version(p) for p in
                ["darts", "pandas", "numpy", "statsmodels", "matplotlib", "scipy"]}
    (OUT / "manifest.json").write_text(json.dumps({"packages": versions,
        "input_sha256": before, "inputs_unchanged": True,
        "model_counts": fits.status.value_counts().to_dict()}, indent=2))
    print(f"Saved analysis to {OUT}; inputs unchanged.\n{fits.status.value_counts()}")


if __name__ == "__main__":
    main()
