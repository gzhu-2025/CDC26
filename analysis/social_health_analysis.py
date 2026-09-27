"""Global conflict predictor vs 24 non-conflict outcomes; exploratory tests."""
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
from scipy.stats import pearsonr, spearmanr
import statsmodels.api as sm
from statsmodels.stats.multitest import multipletests
from statsmodels.stats.diagnostic import acorr_ljungbox
from darts import TimeSeries
from darts.models import ARIMA

from fetch_social_health import OUT, MARKERS
from conflict_indicators import longest_run, hashes

MIN_N = 20
LAGS = (0, 1, 2)


def world(rows):
    records = [r for r in rows if r["countryiso3code"] == "WLD"]
    result = pd.Series({pd.Timestamp(int(r["date"]), 1, 1): r["value"] for r in records}, dtype=float)
    assert len(result) == len(records)
    return result.sort_index()


def load_inputs():
    index = pd.date_range("1989", "2025", freq="YS", name="date")
    levels = pd.DataFrame(index=index)
    coverage = []
    for category, code, label, transform in MARKERS:
        raw = json.loads((OUT / "raw" / f"{code}.json").read_text())
        levels[code] = world(raw["observations"]).reindex(index)
        valid = levels[code].dropna()
        coverage.append(dict(category=category, code=code, label=label, transform=transform,
                             n=len(valid), first_year=valid.index.year.min(), last_year=valid.index.year.max()))
    ucdp = pd.read_csv(OUT / "raw" / "ucdp_country_year.csv")
    assert not ucdp.duplicated(["country_id", "year"]).any()
    pieces = ["sb_total_deaths_best", "ns_total_deaths_best", "os_total_deaths_best"]
    assert ucdp[pieces].notna().all().all()
    assert np.allclose(ucdp[pieces].sum(axis=1), ucdp.cumulative_total_deaths_in_orgvio_best)
    annual = ucdp.groupby("year").cumulative_total_deaths_in_orgvio_best.sum()
    annual.index = pd.to_datetime(annual.index.astype(str), format="%Y")
    population = json.loads((OUT.parent / "world_bank_search" / "api_responses" / "SP.POP.TOTL.json").read_text())
    levels["population"] = world(population["observations"]).reindex(index)
    levels["conflict_deaths"] = annual.reindex(index)
    levels["conflict_rate"] = 1e5 * levels.conflict_deaths / levels.population
    assert levels.conflict_rate.gt(0).all()
    delta = pd.DataFrame(index=index)
    delta["conflict"] = 100 * np.log(levels.conflict_rate).diff()
    for _, code, _, transform in MARKERS:
        s = levels[code]
        if transform == "log":
            assert s.dropna().gt(0).all()
            delta[code] = 100 * np.log(s).diff()
        else:
            delta[code] = s.diff()
    levels.to_csv(OUT / "annual_levels.csv")
    levels.to_pickle(OUT / "annual_levels.pkl")
    delta.to_csv(OUT / "annual_changes.csv")
    pd.DataFrame(coverage).to_csv(OUT / "marker_coverage.csv", index=False)
    return levels, delta


def aligned(delta, code, lag):
    return longest_run(pd.DataFrame({"y": delta[code], "x": delta.conflict.shift(lag)}))


def partial_fit(frame, bandwidth=2):
    z = (frame - frame.mean()) / frame.std(ddof=0)
    trend = np.asarray(frame.index.year, float)
    trend = (trend-trend.mean())/trend.std()
    nuisance = np.column_stack([np.ones(len(frame)), trend])
    xr = sm.OLS(z.x, nuisance).fit().resid
    yr = sm.OLS(z.y, nuisance).fit().resid
    X = np.column_stack([np.ones(len(frame)), z.x, trend])
    fit = sm.OLS(z.y, X).fit(cov_type="HAC", cov_kwds={"maxlags": bandwidth,
                            "use_correction": True}, use_t=True)
    return fit, pd.DataFrame({"x": xr, "y": yr}, index=frame.index), z, trend


def arimax(frame):
    _, _, z, trend = partial_fit(frame)
    series = TimeSeries.from_series(z.y, freq="YS")
    cov = pd.DataFrame({"conflict": z.x, "trend": trend}, index=z.index)
    baseline_cov = TimeSeries.from_dataframe(cov[["trend"]], freq="YS")
    covariates = TimeSeries.from_dataframe(cov, freq="YS")
    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter("always")
        base = ARIMA(p=1, d=0, q=0, trend="c", min_train_length=MIN_N).fit(series, future_covariates=baseline_cov)
        model = ARIMA(p=1, d=0, q=0, trend="c", min_train_length=MIN_N).fit(series, future_covariates=covariates)
    res = model.model
    i = res.param_names.index("x1")
    ok = bool(res.mle_retvals.get("converged", True)) and bool(base.model.mle_retvals.get("converged", True))
    lb = acorr_ljungbox(res.resid, lags=[4], model_df=1).lb_pvalue.iloc[0]
    return model, dict(arimax_beta=float(res.params[i]), arimax_p=float(res.pvalues[i]),
                      arimax_converged=ok, arimax_ljung_box_p=lb,
                      arimax_aic_improvement=base.model.aic-res.aic,
                      arimax_warnings="; ".join(sorted({str(w.message) for w in captured})))


def circular_p(residuals):
    """Rotation sensitivity null, preserving each detrended sequence's ordering.

    Approximate stationarity/exchangeability assumption; coarse resolution 1/n.
    Zero shift is included so the test never returns zero.
    """
    x, y = residuals.x.to_numpy(), residuals.y.to_numpy()
    observed = abs(np.corrcoef(x, y)[0, 1])
    null = [abs(np.corrcoef(np.roll(x, k), y)[0, 1]) for k in range(len(x))]
    return np.mean(np.asarray(null) >= observed-1e-12)


def leave_one_out(frame):
    correlations = []
    for omit in range(len(frame)):
        subset = frame.drop(frame.index[omit])
        time = np.asarray(subset.index.year, float)
        design = np.column_stack([np.ones(len(subset)), time-time.mean()])
        residual = subset.to_numpy() - design @ np.linalg.lstsq(design, subset.to_numpy(), rcond=None)[0]
        correlations.append(np.corrcoef(residual.T)[0, 1])
    return np.array(correlations)


def analyze(levels, delta):
    rows, pairs = [], {}
    (OUT / "models").mkdir(exist_ok=True)
    for category, code, label, transform in MARKERS:
        for lag in LAGS:
            frame = aligned(delta, code, lag)
            row = dict(category=category, code=code, label=label, lag=lag, n=len(frame),
                       transform=transform, first_year=frame.index.year.min() if len(frame) else None,
                       last_year=frame.index.year.max() if len(frame) else None)
            if len(frame) < MIN_N:
                rows.append(row | {"status": "insufficient contiguous annual changes"})
                continue
            fit, residuals, _, _ = partial_fit(frame)
            r = pearsonr(residuals.x, residuals.y).statistic
            raw_r, raw_p = pearsonr(frame.x, frame.y)
            ci = np.asarray(fit.conf_int())[1]
            level_pair = pd.DataFrame({"y": levels[code], "x": levels.conflict_rate.shift(lag)}).loc[frame.index].dropna()
            row.update(status="ok", partial_r=r, change_r=raw_r, naive_pearson_p=raw_p,
                       level_r=level_pair.corr().loc["x", "y"],
                       spearman_r=spearmanr(frame.x, frame.y).statistic,
                       beta=fit.params.iloc[1], ci_low=ci[0], ci_high=ci[1],
                       hac_p=fit.pvalues.iloc[1], circular_p=circular_p(residuals),
                       hac4_p=partial_fit(frame, 4)[0].pvalues.iloc[1])
            loo = leave_one_out(frame)
            influence = np.argmax(abs(loo-r))
            row.update(leave_one_out_r_min=float(loo.min()), leave_one_out_r_max=float(loo.max()),
                       most_influential_year=int(frame.index[influence].year),
                       r_without_most_influential_year=float(loo[influence]))
            # Drop both response pandemic years and years whose lagged conflict
            # change overlaps 2020–2021. Only report the descriptive partial r.
            year = frame.index.year
            pandemic = np.isin(year, [2020, 2021]) | np.isin(year-lag, [2020, 2021])
            subset = frame.loc[~pandemic]
            _, no_pandemic, _, _ = partial_fit(subset)
            row["no_pandemic_partial_r"] = pearsonr(no_pandemic.x, no_pandemic.y).statistic
            row["no_pandemic_n"] = len(subset)
            try:
                model, info = arimax(frame)
                row.update(info)
                model.save(str(OUT / "models" / f"{code}_lag{lag}.pkl"))
            except (ValueError, RuntimeError, np.linalg.LinAlgError) as exc:
                row.update(arimax_converged=False, arimax_error=str(exc))
            rows.append(row)
            pairs[(code, lag)] = residuals
        print(f"Analyzed {category}: {label}", flush=True)
    results = pd.DataFrame(rows)
    for p, q in [("hac_p", "q_bh"), ("circular_p", "circular_q_bh"), ("arimax_p", "arimax_q_bh")]:
        good = results[p].notna()
        if p == "arimax_p":
            good &= results.arimax_converged.eq(True)
        results[q] = np.nan
        results.loc[good, q] = multipletests(results.loc[good, p], method="fdr_bh")[1]
    results.to_csv(OUT / "all_tests.csv", index=False)
    valid = results[results.status.eq("ok")].copy()
    valid["abs_r"] = valid.partial_r.abs()
    best = valid.sort_values("abs_r", ascending=False).drop_duplicates("code")
    best.to_csv(OUT / "strongest_by_marker.csv", index=False)
    return results, best, pairs


def charts(results, best, pairs):
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
    order = [m[1] for m in MARKERS]
    table = results.pivot(index="code", columns="lag", values="partial_r").reindex(order)
    qtable = results.pivot(index="code", columns="lag", values="q_bh").reindex(order)
    fig, ax = plt.subplots(figsize=(9, 11), layout="constrained")
    im = ax.imshow(table, cmap="RdBu_r", vmin=-1, vmax=1, aspect="auto")
    ax.set(yticks=np.arange(24), yticklabels=[m[2] for m in MARKERS], xticks=[0, 1, 2],
           xticklabels=["Same year", "Conflict 1 year earlier", "Conflict 2 years earlier"],
           title="World conflict changes vs social, economic and healthcare changes\nCorrelation after removing a linear time trend")
    for i in range(24):
        for j in range(3):
            value = table.iloc[i, j]
            if pd.notna(value):
                star = "*" if qtable.iloc[i, j] < .05 else ""
                ax.text(j, i, f"{value:+.2f}{star}", ha="center", va="center", fontsize=9,
                        color="white" if abs(value) > .6 else "black")
    for y in [7.5, 15.5]:
        ax.axhline(y, color="black", linewidth=1.5)
    fig.colorbar(im, ax=ax, label="Partial Pearson r")
    fig.supxlabel("* HAC p-value passes Benjamini–Hochberg FDR < 0.05 across all tested markers and lags.\nBlank cells: fewer than 20 consecutive annual changes. Exploratory, not causal.", fontsize=9)
    fig.savefig(OUT / "correlation_heatmap.png", dpi=180)
    plt.close(fig)
    top = best.head(6)
    fig, axes = plt.subplots(2, 3, figsize=(14, 8), layout="constrained")
    for ax, row in zip(axes.flat, top.itertuples()):
        pair = pairs[(row.code, row.lag)]
        ax.scatter(pair.x, pair.y, c=pair.index.year, cmap="viridis", s=35, alpha=.8)
        slope, intercept = np.polyfit(pair.x, pair.y, 1)
        xs = np.array([pair.x.min(), pair.x.max()])
        ax.plot(xs, intercept+slope*xs, color="#dc6234", linewidth=1.5)
        ax.set(title=f"{row.label} | lag {row.lag}\nr={row.partial_r:+.2f}, p={row.hac_p:.3g}, q={row.q_bh:.3g}, n={row.n}",
               xlabel="Conflict change, detrended (standardized)", ylabel="Marker change, detrended (standardized)")
        extreme = np.argmax(pair.x.to_numpy()**2+pair.y.to_numpy()**2)
        point = pair.iloc[extreme]
        ax.annotate(str(pair.index[extreme].year), (point.x, point.y), xytext=(4, 5), textcoords="offset points", fontsize=8)
    fig.suptitle("Six largest absolute associations across distinct markers\nSelected after testing 0–2 year lags; p uses HAC errors, q corrects all eligible tests\nWithin each panel: purple = earlier years, yellow = later years", fontsize=12)
    fig.savefig(OUT / "strongest_scatterplots.png", dpi=180)
    plt.close(fig)
    top = best.head(12).iloc[::-1]
    fig, ax = plt.subplots(figsize=(11, 7), layout="constrained")
    for i, row in enumerate(top.itertuples()):
        color = "#0a8574" if row.q_bh < .05 else "#818a99"
        ax.errorbar(row.beta, i, xerr=[[row.beta-row.ci_low], [row.ci_high-row.beta]], fmt="o", color=color, capsize=4)
        ax.text(1.01, i, f"q={row.q_bh:.3f}", transform=ax.get_yaxis_transform(), va="center", fontsize=9)
    ax.axvline(0, color="black", linewidth=.8)
    ax.set(yticks=np.arange(len(top)), yticklabels=[f"{r.label} (lag {r.lag})" for r in top.itertuples()],
           xlabel="Standardized association coefficient and pointwise 95% HAC confidence interval",
           title="Largest associations: effect sizes and uncertainty\nGreen: FDR < 0.05; gray: does not pass. Intervals are not selection-adjusted.")
    fig.savefig(OUT / "effect_intervals.png", dpi=180)
    plt.close(fig)


def report(results, best):
    valid = results[results.status.eq("ok")]
    sig = valid[valid.q_bh.lt(.05)]
    top = best.iloc[0]
    lines = ["# Social, economic and healthcare markers vs global conflict", "",
             f"Screened 24 non-conflict outcomes at lags 0, 1 and 2. {len(valid)} of 72 prespecified tests had at least 20 consecutive annual changes; {len(sig)} pass the primary FDR threshold q < 0.05. Displacement, refugees, violence and governance are excluded from outcomes. Conflict remains the predictor.", "",
             f"The largest association is {top.label} at lag {int(top.lag)} (r = {top.partial_r:+.3f}, HAC p = {top.hac_p:.4f}, q = {top.q_bh:.4f}). Removing its most influential response year, {int(top.most_influential_year)}, changes r to {top.r_without_most_influential_year:+.3f}. This is a sensitivity check, not a reason to delete that year from the primary analysis.", "",
             f"The alternative ARIMAX specification has {int(valid.arimax_q_bh.lt(.05).sum())} coefficients with its own q < 0.05, while circular-shift tests have {int(valid.circular_q_bh.lt(.05).sum())}. Thus conclusions depend on the error model; ARIMAX uses model-based outer-product-of-gradients covariance and should not override conflicting robust tests or influence diagnostics.", "",
             "## Strongest associations", "",
             "Ranked by absolute trend-adjusted correlation, one best lag per marker. A large correlation is not automatically significant. Positive lag means conflict occurs first. Positive r means changes move together, not that the outcome improves; mortality and unemployment have opposite welfare interpretations to GDP and life expectancy.", "",
             "| Marker | Category | Lag | Years | n | Partial r | HAC p | BH q | Circular-shift p | ARIMAX q |",
             "|---|---|---:|---|---:|---:|---:|---:|---:|---:|"]
    for r in best.head(10).itertuples():
        lines.append(f"| {r.label} | {r.category} | {r.lag} | {r.first_year}–{r.last_year} | {r.n} | {r.partial_r:+.3f} | {r.hac_p:.4f} | {r.q_bh:.4f} | {r.circular_p:.4f} | {r.arimax_q_bh:.4f} |")
    lines += ["", "![All markers and lags](correlation_heatmap.png)", "",
              "![Strongest scatterplots](strongest_scatterplots.png)", "",
              "![Effect sizes and confidence intervals](effect_intervals.png)", "",
              "## Statistical tests", "",
              "- Primary null: the coefficient on conflict change is zero in marker change ~ constant + conflict change + linear calendar-year trend. Standardize both changes. Test is two-sided, Student-t reference with n−3 degrees of freedom and Newey–West/HAC covariance, Bartlett kernel, bandwidth 2 and finite-sample covariance correction. The reported partial r removes a linear time trend from both changes. It is not a raw-level correlation.",
              "- Benjamini–Hochberg adjusts the primary HAC p-values across every eligible marker × lag test, including those not shown among the strongest. The screen is exploratory; correlated outcomes, a small sample and post-selection mean q-values are not a guarantee of replication.",
              "- Sensitivities in all_tests.csv: unadjusted change Pearson r/p (IID assumption; not the primary test), Spearman r, level r, HAC bandwidth 4 p, removal of pandemic response/predictor years, leave-one-year-out correlations, and a circular-shift p-value. Circular shifts preserve the order of each detrended sequence but assume approximate stationarity/circular exchangeability and have coarse resolution 1/n. Their own BH q-values are included. Leave-one-out removal refits the time trend and reports sensitivity, not a revised preferred estimate.",
              "- Darts ARIMA(1,0,0) on standardized changes, with conflict and linear time trend as external regressors (ARIMAX), checks an alternative AR(1) error specification. Baseline contains the same trend but no conflict. All ARIMAX p-values are separately BH-adjusted over converged fits. Residual Ljung–Box tests, convergence, and AIC differences are saved. Minimum train length is explicitly 20; this remains a small exploratory sample. Models are saved under models/.",
              "- No forecasts or causal effects are claimed. Confidence intervals are pointwise, not adjusted for selecting the strongest associations. Disagreement between HAC, ARIMAX, or circular-shift results should be reported rather than choosing the most favorable p-value.", "",
              "## Data and transformations", "",
              "- World Bank official WLD aggregates; the 24-marker shortlist was fixed before testing. Health sources include national/UN/WHO/UNICEF estimates distributed through WDI; exact definitions and providers are in definitions.json. Some global health and social series are modeled or smoothed, so annual values are not independent new surveys.",
              "- Conflict: UCDP OrganizedViolenceCY v26.1, country-year 1989–2025, sum of state-based, non-state and one-sided best-estimate fatalities. Code verifies that component sums equal the dataset's combined deaths. The global proxy uses recorded deaths in UCDP's state coverage divided by World Bank world population, times 100,000. UCDP's inclusion threshold and reporting limitations remain; this is not all violent deaths everywhere.",
              "- GDP, consumption and mortality rates use 100 × annual log change. Other outcomes use annual differences in their stated units (percentage points for shares/rates; years for life expectancy). Inflation is already a rate, so its difference is inflation acceleration. Conflict uses 100 × annual log change in the death rate. See prespecified_markers.csv.",
              "- Annual calendar index is retained before differencing and lagging. No interpolation, no replacement of missing outcomes by zero. Each test uses its longest complete annual segment. Coverage differs across markers; years/n appear in every result. Poverty's missing 2019 value truncates its model sample to the earlier run. No 2026 values are included.",
              "- The original data/ files and metadata remain unchanged; input hashes and package versions are recorded in manifest.json.", "",
              "## Reproduce", "", "```sh", "python analysis/fetch_social_health.py --ucdp",
              "python analysis/social_health_analysis.py", "```", "",
              "Dependencies: analysis/requirements.txt plus requests. Fetching reuses saved raw responses; retain these to reproduce this vintage. Full tests: all_tests.csv; strongest per marker: strongest_by_marker.csv; raw levels and changes: annual_levels.csv and annual_changes.csv. The saved models expect the same training-window standardization and trend used by this script.", "",
              "Sources: [World Bank WDI people indicators](https://datatopics.worldbank.org/world-development-indicators/themes/people.html), [UCDP v26.1 codebook](https://ucdp.uu.se/downloads/organizedviolencecy/UCDP_OrganizedViolenceCY_Codebook_261.pdf), [statsmodels HAC inference](https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.OLSResults.get_robustcov_results.html).", ""]
    (OUT / "report.md").write_text("\n".join(lines))


def main():
    before = hashes()
    levels, delta = load_inputs()
    results, best, pairs = analyze(levels, delta)
    charts(results, best, pairs)
    report(results, best)
    assert hashes() == before
    files = list((OUT / "raw").glob("*")) + [OUT / "prespecified_markers.csv", OUT / "definitions.json"]
    (OUT / "manifest.json").write_text(json.dumps({
        "input_sha256": {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
        "original_data_sha256": before, "original_data_unchanged": True,
        "packages": {p: importlib.metadata.version(p) for p in ["pandas", "numpy", "scipy", "statsmodels", "darts", "matplotlib"]},
        "n_tests": int(results.status.eq("ok").sum()),
    }, indent=2))
    print(best[["label", "lag", "n", "partial_r", "hac_p", "q_bh", "circular_p", "arimax_q_bh"]].head(10).to_string(index=False))


if __name__ == "__main__":
    main()
