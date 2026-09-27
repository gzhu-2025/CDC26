"""Use new civilian fatality data with 36 non-conflict World Bank markers."""
from pathlib import Path
import hashlib
import json
import os

os.environ.setdefault("MPLCONFIGDIR", "/private/tmp/cdc26-mpl")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import t
from statsmodels.stats.multitest import multipletests
from fetch_expanded_markers import OUT, ALL_MARKERS, ADDED
from conflict_indicators import hashes, longest_run
from social_health_analysis import partial_fit, arimax

ROOT = Path(__file__).resolve().parents[1]
METRICS = ['civilian', 'total', 'civilian_targeting', 'political_violence', 'demonstrations']
ALIASES = {
    "Bahamas": "BHS", "Brunei": "BRN", "Cape Verde": "CPV", "Czech Republic": "CZE",
    "Democratic Republic of Congo": "COD", "Republic of Congo": "COG", "East Timor": "TLS",
    "Egypt": "EGY", "Gambia": "GMB", "Iran": "IRN", "Ivory Coast": "CIV",
    "Kyrgyzstan": "KGZ", "Laos": "LAO", "Micronesia": "FSM", "Nauru": "NRU",
    "North Korea": "PRK", "Palestine": "PSE", "Puerto Rico": "PRI", "Russia": "RUS",
    "Saint Kitts and Nevis": "KNA", "Saint Lucia": "LCA", "Saint Vincent and the Grenadines": "VCT",
    "Sint Maarten": "SXM", "Slovakia": "SVK", "Somalia": "SOM", "South Korea": "KOR",
    "Syria": "SYR", "Turkey": "TUR", "Venezuela": "VEN", "Vietnam": "VNM",
    "Virgin Islands, U.S.": "VIR", "Yemen": "YEM", "eSwatini": "SWZ",
}


def wb_frame(code):
    payload = json.loads((OUT / "raw" / f"{code}.json").read_text())
    records = [{"iso3": r['countryiso3code'], "year": int(r['date']), "value": r['value']}
               for r in payload['observations'] if r['countryiso3code']]
    d = pd.DataFrame(records)
    assert not d.duplicated(['iso3', 'year']).any()
    return d


def prepare():
    cs = json.loads((OUT.parent / "world_bank_search" / "countries.json").read_text())
    countries = {r['id'] for r in cs if r['region']['value'].strip() != 'Aggregates'}
    names = {r['name']: r['id'] for r in cs if r['id'] in countries}
    names.update(ALIASES)
    assert set(ALIASES.values()) <= countries
    sources = {
        "civilian": ROOT / 'data/Conflict/number_of_reported_civilian_fatalities_by_country-year_as-of-18Sep2026.xlsx',
        "total": ROOT / 'data/Conflict/number_of_reported_fatalities_by_country-year_as-of-18Sep2026.xlsx',
        "civilian_targeting": ROOT / 'data/Conflict/number_of_events_targeting_civilians_by_country-year_as-of-18Sep2026.xlsx',
        "political_violence": ROOT / 'data/Conflict/number_of_political_violence_events_by_country-year_as-of-18Sep2026.xlsx',
        "demonstrations": ROOT / 'data/Conflict/number_of_demonstration_events_by_country-year_as-of-18Sep2026.xlsx',
    }
    original = ROOT / 'data/Conflict/number_of_reported_fatalities_by_country-year_as-of-18Sep2026.xlsx'
    copy = original.with_name(original.stem + ' copy.xlsx')
    duplicate = copy.read_bytes() == original.read_bytes() if copy.exists() else 'previously verified identical; user subsequently removed copy'
    tables, mappings, coverage = {}, [], []
    for metric, path in sources.items():
        raw = pd.read_excel(path)
        value = 'FATALITIES' if 'FATALITIES' in raw else 'EVENTS'
        assert not raw.duplicated(['COUNTRY', 'YEAR']).any()
        assert raw[value].notna().all() and raw[value].ge(0).all()
        if not path.with_suffix('.pkl').exists():
            ts = raw.copy()
            ts.index = pd.DatetimeIndex(pd.to_datetime(ts.YEAR.astype(str), format='%Y'), name='date')
            ts = ts.sort_index(kind='stable')
            ts.attrs.update(source_file=path.name, observation_frequency='annual')
            ts.to_pickle(path.with_suffix('.pkl'))
            pd.testing.assert_frame_equal(ts, pd.read_pickle(path.with_suffix('.pkl')))
        d = raw[raw.YEAR.between(1997, 2025)].copy()
        d['iso3'] = d.COUNTRY.map(names)
        for name, group in d.groupby('COUNTRY'):
            mappings.append({'metric': metric, 'source_name': name, 'iso3': names.get(name),
                             'rows': len(group), 'reported_count': int(group[value].sum())})
        for year, group in d.groupby('YEAR'):
            coverage.append({'metric': metric, 'year': year, 'reported_entities': len(group),
                             'mapped_countries': int(group.iso3.notna().sum()),
                             'reported_count': group[value].sum(),
                             'mapped_count': group.loc[group.iso3.notna(), value].sum()})
        d = d.dropna(subset=['iso3']).rename(columns={'YEAR':'year', value: metric})
        assert not d.duplicated(['iso3', 'year']).any()
        tables[metric] = d.set_index(['iso3', 'year'])[metric]
    pd.DataFrame(mappings).to_csv(OUT / 'country_mapping.csv', index=False)
    pd.DataFrame(coverage).to_csv(OUT / 'conflict_coverage.csv', index=False)
    mapped=pd.DataFrame(mappings)
    mapped[mapped.iso3.isna()].to_csv(OUT / 'unmatched_entities.csv', index=False)
    index = pd.MultiIndex.from_product([sorted(countries), range(1995, 2026)], names=['iso3','year'])
    panel = pd.DataFrame(index=index)
    for metric, series in tables.items():
        panel[metric] = series.reindex(index)
    population = wb_frame('SP.POP.TOTL')
    panel['population'] = population.set_index(['iso3','year']).value.reindex(index)
    for _, code, _, _ in ALL_MARKERS:
        panel[code] = wb_frame(code).set_index(['iso3','year']).value.reindex(index)
    pair = panel[['civilian','total']].dropna()
    exceed = pair[pair.civilian > pair.total]
    exceed.to_csv(OUT / 'civilian_exceeds_total.csv')
    panel.to_pickle(OUT / 'country_year_levels.pkl')
    panel.to_csv(OUT / 'country_year_levels.csv')
    monthly=pd.read_pickle(ROOT/'data/Conflict/number_of_political_violence_events_by_country-month-year_as-of-18Sep2026.pkl')
    yearly=pd.read_excel(sources['political_violence'])
    annual_equals_monthly=yearly.set_index(['COUNTRY','YEAR']).EVENTS.sort_index().equals(
        monthly.groupby(['COUNTRY','YEAR']).EVENTS.sum().sort_index())
    (OUT / 'new_input_audit.json').write_text(json.dumps({
        'total_copy_identical_to_existing': duplicate,
        'total_used_once': True, 'civilian_exceeds_total_rows': len(exceed),
        'annual_political_events_equal_monthly_sums': annual_equals_monthly,
        'input_paths': {k: str(v) for k,v in sources.items()},
        'partial_2026_excluded': True,
    }, indent=2))
    return panel


def transformed_panel(panel):
    d = pd.DataFrame(index=panel.index)
    for _, code, _, transform in ALL_MARKERS:
        value = panel[code]
        if transform == 'log':
            value = 100*np.log(value.where(value > 0))
        d[code] = value.groupby(level='iso3').diff()
    for metric in METRICS:
        rate = panel[metric] / panel.population.where(panel.population > 0) * 1e5
        change = np.log1p(rate).groupby(level='iso3').diff()
        # First reported year may be partial. Require two later observed years
        # before allowing the first change, without imputing any missing year.
        first = panel[metric].dropna().reset_index().groupby('iso3').year.min()
        start = panel.index.get_level_values('iso3').map(first).to_numpy()
        change = change.where(panel.index.get_level_values('year') >= start+2)
        for lag in [0,1,2]:
            d[f'{metric}_lag{lag}'] = change.groupby(level='iso3').shift(lag)
    return d


def absorb(values, country, year, tol=1e-10):
    """Alternating projections for unbalanced two-way fixed effects."""
    values = np.asarray(values, float).copy()
    for iteration in range(1000):
        previous = values.copy()
        for group in [country, year]:
            counts = np.bincount(group)
            for col in range(values.shape[1]):
                sums = np.bincount(group, weights=values[:,col])
                values[:,col] -= (sums / counts)[group]
        if np.max(abs(values-previous)) < tol:
            return values
    raise RuntimeError('Fixed-effect demeaning did not converge')


def panel_fit(frame):
    frame = frame.dropna().copy()
    # Remove country/year singleton cells iteratively.
    while len(frame):
        good = (frame.groupby(level='iso3').y.transform('size') >= 2) & (frame.groupby(level='year').y.transform('size') >= 2)
        if good.all():
            break
        frame = frame[good]
    c, cn = pd.factorize(frame.index.get_level_values('iso3'))
    y, yn = pd.factorize(frame.index.get_level_values('year'))
    n, g, periods = len(frame), len(cn), len(yn)
    if n < 300 or g < 30 or periods < 15:
        return {'status': 'insufficient country-year coverage', 'n':n, 'countries':g, 'years':periods}, None
    scale = frame.std(ddof=0)
    z = (frame-frame.mean())/scale
    resid = absorb(z[['y','x']], c, y)
    yr, xr = resid[:,0], resid[:,1]
    xx = xr@xr
    if xx < 1e-12:
        return {'status':'no within-country variation', 'n':n, 'countries':g, 'years':periods}, None
    beta = (xr@yr)/xx
    error = yr-beta*xr
    score = xr*error
    # Scalar two-way cluster sandwich: country + year - country/year cell.
    # Rank <= G+T for connected country-year graphs; using G+T is conservative
    # for disconnected graphs and accounts for absorbed fixed effects.
    k = g+periods
    correction = (n-1)/(n-k)
    mc = np.sum(np.bincount(c, weights=score)**2)*g/(g-1)*correction
    mt = np.sum(np.bincount(y, weights=score)**2)*periods/(periods-1)*correction
    mi = np.sum(score**2)*n/(n-1)*correction
    variance = (mc+mt-mi)/(xx**2)
    if variance <= 0:
        return {'status':'nonpositive two-way cluster variance', 'n':n, 'countries':g, 'years':periods}, None
    se = np.sqrt(variance)
    dof = min(g,periods)-1
    critical = t.ppf(.975,dof)
    result = dict(status='ok', n=n, countries=g, years=periods,
                  first_year=int(min(yn)), last_year=int(max(yn)), beta=beta,
                  se=se, p=2*t.sf(abs(beta/se),dof), ci_low=beta-critical*se, ci_high=beta+critical*se,
                  partial_r=np.corrcoef(xr,yr)[0,1],
                  raw_unit_beta=beta*scale.y/scale.x,
                  country_cluster_p=2*t.sf(abs(beta/np.sqrt(mc/xx**2)),g-1))
    points = pd.DataFrame({'x':xr,'y':yr}, index=frame.index)
    return result, points


def country_models(changes):
    rows, pairs = [], {}
    for category, code, label, transform in ALL_MARKERS:
        for metric in METRICS:
            for lag in [0,1,2]:
                frame = pd.DataFrame({'y':changes[code], 'x':changes[f'{metric}_lag{lag}']}).dropna()
                result, points = panel_fit(frame)
                result.update(category=category,code=code,label=label,metric=metric,lag=lag, new_marker=code in {m[1] for m in ADDED})
                rows.append(result)
                if points is not None:
                    pairs[(code,metric,lag)] = points
        print(f'Country models: {label}', flush=True)
    results = pd.DataFrame(rows)
    valid = results.status.eq('ok')
    for method,name in [('fdr_bh','q_bh'),('holm','p_holm')]:
        results.loc[valid,name] = multipletests(results.loc[valid,'p'],method=method)[1]
    results.to_csv(OUT/'country_tests.csv', index=False)
    return results,pairs


def global_models(panel):
    # Secondary analysis: all reported totals retain changing geographic coverage.
    coverage = pd.read_csv(OUT/'conflict_coverage.csv')
    index = pd.date_range('1997','2025',freq='YS')
    population = wb_frame('SP.POP.TOTL').query("iso3 == 'WLD'").set_index('year').value
    population.index = pd.to_datetime(population.index.astype(str),format='%Y')
    exposures={}
    fixed_exposures={}
    regional=panel.loc[panel.index.get_level_values('year')>=1997]
    for metric in METRICS:
        annual=coverage[coverage.metric.eq(metric)].set_index('year').reported_count
        annual.index=pd.to_datetime(annual.index.astype(str),format='%Y')
        rate=(annual/population).reindex(index)*1e5
        exposures[metric]=100*np.log1p(rate).diff()
        counts=regional[metric].notna().groupby(level='iso3').sum()
        cohort=counts[counts.eq(29)].index
        subset=regional.loc[regional.index.get_level_values('iso3').isin(cohort)]
        deaths=subset[metric].groupby(level='year').sum(min_count=len(cohort))
        pop=subset.population.groupby(level='year').sum(min_count=len(cohort))
        fixed_rate=deaths/pop*1e5
        fixed_rate.index=pd.to_datetime(fixed_rate.index.astype(str),format='%Y')
        fixed_exposures[metric]=(100*np.log1p(fixed_rate).diff(),len(cohort))
    rows=[]
    for category,code,label,transform in ALL_MARKERS:
        series=wb_frame(code).query("iso3 == 'WLD'").set_index('year').value
        series.index=pd.to_datetime(series.index.astype(str),format='%Y')
        series=series.reindex(index)
        dy=(100*np.log(series.where(series>0)) if transform=='log' else series).diff()
        for metric,x in exposures.items():
            for lag in [0,1,2]:
                frame=longest_run(pd.DataFrame({'y':dy,'x':x.shift(lag)}))
                row=dict(code=code,label=label,category=category,metric=metric,lag=lag,n=len(frame))
                if len(frame)<20:
                    rows.append(row|{'status':'insufficient contiguous world data'})
                    continue
                fit,resid,_,_=partial_fit(frame)
                row.update(status='ok',partial_r=resid.corr().loc['x','y'],p=fit.pvalues.iloc[1],
                           first_year=frame.index.year.min(),last_year=frame.index.year.max())
                no_pandemic=frame.loc[~frame.index.year.isin([2020,2021])]
                _,resid_np,_,_=partial_fit(no_pandemic)
                row['no_pandemic_response_r']=resid_np.corr().loc['x','y']
                fixed_x,cohort_n=fixed_exposures[metric]
                fixed_frame=longest_run(pd.DataFrame({'y':dy,'x':fixed_x.shift(lag)})).reindex(frame.index).dropna()
                if len(fixed_frame)>=20:
                    fixed_fit,fixed_resid,_,_=partial_fit(fixed_frame)
                    row.update(fixed_cohort_r=fixed_resid.corr().loc['x','y'],fixed_cohort_p=fixed_fit.pvalues.iloc[1],fixed_cohort_countries=cohort_n)
                try:
                    _,info=arimax(frame)
                    row.update(info)
                except (ValueError,RuntimeError,np.linalg.LinAlgError) as exc:
                    row.update(arimax_converged=False, arimax_error=str(exc))
                rows.append(row)
        print(f'Global sensitivity: {label}',flush=True)
    results=pd.DataFrame(rows)
    valid=results.status.eq('ok')
    results.loc[valid,'q_bh']=multipletests(results.loc[valid,'p'],method='fdr_bh')[1]
    valid_ar=results.arimax_converged.eq(True)&results.arimax_p.notna()
    results.loc[valid_ar,'arimax_q_bh']=multipletests(results.loc[valid_ar,'arimax_p'],method='fdr_bh')[1]
    good=results.fixed_cohort_p.notna()
    results.loc[good,'fixed_cohort_q_bh']=multipletests(results.loc[good,'fixed_cohort_p'],method='fdr_bh')[1]
    results.to_csv(OUT/'global_tests.csv',index=False)
    return results


def sensitivity(results, changes):
    # Refit shortlisted associations after omitting each country in turn.
    # Selection is explicit; these are robustness descriptions, not extra discoveries.
    best=results[results.status.eq('ok')].sort_values(['q_bh','p']).drop_duplicates('code').head(8)
    rows=[]
    for row in best.itertuples():
        frame=pd.DataFrame({'y':changes[row.code],'x':changes[f'{row.metric}_lag{row.lag}']}).dropna()
        estimates=[]
        for country in frame.index.get_level_values('iso3').unique():
            r,_=panel_fit(frame.drop(index=country,level='iso3'))
            if r['status']=='ok':
                estimates.append((country,r['beta'],r['p']))
        critical=max(estimates,key=lambda e:abs(e[1]-row.beta))
        rows.append(dict(code=row.code,label=row.label,metric=row.metric,lag=row.lag,
                         beta=row.beta,q_bh=row.q_bh,
                         loo_beta_min=min(e[1] for e in estimates),loo_beta_max=max(e[1] for e in estimates),
                         most_influential_country=critical[0],beta_without_country=critical[1],
                         p_without_country=critical[2],
                         all_country_omissions_same_sign=all(np.sign(e[1])==np.sign(row.beta) for e in estimates)))
        print(f'Country influence check: {row.label}',flush=True)
    checks=pd.DataFrame(rows)
    checks.to_csv(OUT/'country_influence.csv',index=False)
    return checks


def figures(results,pairs):
    best=results[results.status.eq('ok')].sort_values(['q_bh','p']).drop_duplicates('code').head(12)
    best.to_csv(OUT/'shortlist.csv',index=False)
    fig,ax=plt.subplots(figsize=(12,8),layout='constrained')
    reverse=best.iloc[::-1]
    for i,r in enumerate(reverse.itertuples()):
        ax.errorbar(r.beta,i,xerr=[[r.beta-r.ci_low],[r.ci_high-r.beta]],fmt='o',capsize=4,
                    color='#087e8b' if r.q_bh<.05 else '#8793a3')
        ax.text(1.01,i,f'r={r.partial_r:+.3f}; q={r.q_bh:.3g}',transform=ax.get_yaxis_transform(),va='center',fontsize=9)
    ax.axvline(0,color='black',lw=.8)
    ax.set(yticks=np.arange(len(reverse)),yticklabels=[f'{r.label}\n{r.metric}, lag {r.lag}' for r in reverse.itertuples()],
           xlabel='Standardized coefficient; pointwise 95% CI, clustered by country and year',
           title='Expanded country-level analysis: strongest statistical evidence\nCountry and year fixed effects on annual changes; 36 outcomes, five exposures, three lags')
    fig.savefig(OUT/'country_effects.png',dpi=180);plt.close(fig)
    fig,axes=plt.subplots(2,3,figsize=(14,8),layout='constrained')
    for ax,r in zip(axes.flat,best.head(6).itertuples()):
        pts=pairs[(r.code,r.metric,r.lag)]
        ax.scatter(pts.x,pts.y,s=8,alpha=.12,color='#16798c')
        xs=np.array([pts.x.min(),pts.x.max()]);ax.plot(xs,r.beta*xs,color='#d65f33')
        ax.set(title=f'{r.label}\n{r.metric}, lag {r.lag}; r={r.partial_r:+.3f}; q={r.q_bh:.3g}',
               xlabel='Conflict change after fixed effects',ylabel='Outcome change after fixed effects')
    fig.suptitle('Country-year observations: selected associations\nAll plotted points retained; correlation is not a causal effect')
    fig.savefig(OUT/'country_scatterplots.png',dpi=180);plt.close(fig)
    c=pd.read_csv(OUT/'conflict_coverage.csv')
    fig,ax=plt.subplots(figsize=(9,4),layout='constrained')
    for metric,g in c.groupby('metric'):
        ax.plot(g.year,g.mapped_countries,label=metric)
    ax.set(title='Reporting coverage in the supplied workbooks',xlabel='Year',ylabel='Mapped countries with a reported row')
    ax.legend();fig.savefig(OUT/'reporting_coverage.png',dpi=180);plt.close(fig)
    return best


def global_figure(results):
    selected=results[results.q_bh.lt(.05)].sort_values('q_bh').drop_duplicates('code').head(9)
    if selected.empty:
        return
    fig,ax=plt.subplots(figsize=(12,8),layout='constrained')
    positions=np.arange(len(selected))
    for offset,col,label,color in [(-.24,'partial_r','All reported entities','#277da8'),
                                  (0,'no_pandemic_response_r','Omit outcome years 2020–2021','#ef923d'),
                                  (.24,'fixed_cohort_r','Fixed reporting-country cohort','#648d65')]:
        ax.barh(positions+offset,selected[col],height=.23,label=label,color=color)
    ax.set(yticks=positions,yticklabels=[f'{r.label}\n{r.metric}, lag {r.lag}; q={r.q_bh:.3g}' for r in selected.itertuples()],
           xlim=(-1,1),xlabel='Trend-adjusted annual-change correlation',
           title='Global associations passing FDR: sensitivity to sample choices\nFixed-cohort exposure is regional, not a worldwide conflict measure')
    ax.axvline(0,color='black',lw=.7);ax.legend(loc='lower right',fontsize=9)
    ax.invert_yaxis()
    fig.savefig(OUT/'global_robustness.png',dpi=180);plt.close(fig)


def readable_tables(text, best, checks, global_results):
    """Keep report tables narrow while preserving all reported statistics."""
    exposure = {
        'civilian': 'Civilian fatalities', 'total': 'Total fatalities',
        'civilian_targeting': 'Events targeting civilians',
        'political_violence': 'Political-violence events',
        'demonstrations': 'Demonstrations',
    }
    countries = {r['id']: r['name'] for r in json.loads(
        (OUT.parent/'world_bank_search/countries.json').read_text())}

    def lag(value):
        return 'Same year' if value == 0 else f'{int(value)} year' + ('s' if value != 1 else '')

    def probability(value):
        return f'{value:.6f}' if value < .001 else f'{value:.4f}'

    def table(headers, rows, numeric):
        separator = ['---:' if i in numeric else '---' for i in range(len(headers))]
        return '\n'.join('| ' + ' | '.join(row) + ' |' for row in [headers, separator, *rows])

    def replace_table(document, prefix, replacement):
        start = document.index(prefix)
        end = document.index('\n\n', start)
        return document[:start] + replacement + document[end:]

    main = table(['Outcome', 'Exposure', 'Timing', 'r', 'p-value', 'Adjusted q'], [
        [r.label, exposure[r.metric], lag(r.lag), f'{r.partial_r:+.3f}', probability(r.p), probability(r.q_bh)]
        for r in best.itertuples()], {3,4,5})
    sample = table(['Outcome', 'Country-year observations', 'Countries', 'Holm-adjusted p'], [
        [r.label, f'{r.n:,}', f'{r.countries:,}', probability(r.p_holm)] for r in best.itertuples()], {1,2,3})
    text = replace_table(text, '| Outcome | Exposure | Lag | Country-years |',
        main + '\n\n**Sample sizes and stricter correction**\n\n' + sample +
        '\n\nTiming indicates how much earlier the exposure change occurs. '
        'Adjusted q uses Benjamini–Hochberg correction; none of these country-level results has q < 0.05.')

    influence = table(['Outcome', 'Country omitted', 'β: full → omitted', 'p-value after omission', 'Sign stable?'], [
        [r.label, countries.get(r.most_influential_country, r.most_influential_country),
         f'{r.beta:+.3f} → {r.beta_without_country:+.3f}', probability(r.p_without_country),
         'Yes' if r.all_country_omissions_same_sign else 'No'] for r in checks.itertuples()], {3})
    text = replace_table(text, '| Outcome | Most influential country |', influence +
        '\n\nβ is the standardized coefficient. “Sign stable” means its direction stayed the same '
        'under every single-country omission; it does not mean statistical significance was retained.')

    selected = global_results[global_results.q_bh.lt(.05)].sort_values('q_bh')
    main = table(['Outcome', 'Exposure', 'Timing', 'r', 'p-value', 'Adjusted q'], [
        [r.label, exposure[r.metric], lag(r.lag), f'{r.partial_r:+.3f}', probability(r.p), probability(r.q_bh)]
        for r in selected.itertuples()], {3,4,5})
    robustness = table(['Outcome', 'Original r', 'r without 2020–2021', 'Fixed-cohort r', 'Fixed-cohort q'], [
        [r.label, f'{r.partial_r:+.3f}', f'{r.no_pandemic_response_r:+.3f}',
         f'{r.fixed_cohort_r:+.3f}', probability(r.fixed_cohort_q_bh)] for r in selected.itertuples()], {1,2,3,4})
    text = replace_table(text, '| Outcome | Exposure | Lag | Original r |',
        '**Main global results**\n\n' + main +
        '\n\n**Robustness checks for the same relationships**\n\n' + robustness +
        '\n\nAll correlations describe annual changes after removing a linear time trend. '
        'The fixed-cohort check uses a regional reporting sample, not worldwide exposure.')
    return text


def report(results,global_results,checks,best):
    valid=results[results.status.eq('ok')]
    audit=json.loads((OUT/'new_input_audit.json').read_text())
    lines=['# Expanded analysis using the new datasets','',
           f'Added 12 non-conflict indicators, bringing the outcome set to 36. Fitted {len(valid)} eligible country-panel tests of 540 prespecified combinations. {int(valid.q_bh.lt(.05).sum())} pass BH q < 0.05; {int(valid.p_holm.lt(.05).sum())} pass Holm family-wise correction. These remain exploratory associations, not causal effects or validated forecasts.','',
           '## New data','',
           '- Added civilian fatalities, civilian-targeting events, demonstration events, and annual political-violence events as separate predictors, alongside total fatalities. Date-indexed pandas copies are saved beside each new workbook.',
           f"- Total-fatalities duplicate audit: {audit['total_copy_identical_to_existing']}. Annual political-violence counts equal the existing monthly sums: {audit['annual_political_events_equal_monthly_sums']}. Neither duplicate representation is counted twice. Exposures are tested separately, never added together; demonstrations are not assumed to be violent.",
           '- Exclude partial 2026. Reporting expands geographically over time. Missing country-years are not zero-filled. Country-name mappings and unmatched territories/oceans are exported for review. Fixed effects do not eliminate changes in reporting quality or selection.','',
           '## Additional outcomes','',
           ', '.join(m[2] for m in ADDED)+'. Sparse markers are retained in the audit and skipped where minimum sample requirements fail.','',
           '## Strongest country-level evidence','',
           'One best statistical result per outcome is displayed; all eligible tests are included in the multiple-comparison correction. r is the within-sample correlation after removing country and year effects. A small r can be statistically significant in a large panel.','',
           '| Outcome | Exposure | Lag | Country-years | Countries | Partial r | p | BH q | Holm p |',
           '|---|---|---:|---:|---:|---:|---:|---:|---:|']
    for r in best.itertuples():
        lines.append(f'| {r.label} | {r.metric} | {r.lag} | {r.n} | {r.countries} | {r.partial_r:+.3f} | {r.p:.4g} | {r.q_bh:.4g} | {r.p_holm:.4g} |')
    lines+=['','![Effect intervals](country_effects.png)','','![Country-year scatterplots](country_scatterplots.png)','','## Influence checks','',
            'Refit the top eight distinct outcomes after dropping each country in turn. These checks are descriptive and selected after screening; p-values here are unadjusted.','',
            '| Outcome | Most influential country | Original beta | Beta without country | Unadjusted p without country | Sign stable across all omissions |',
            '|---|---|---:|---:|---:|---|']
    for r in checks.itertuples():
        lines.append(f'| {r.label} | {r.most_influential_country} | {r.beta:+.3f} | {r.beta_without_country:+.3f} | {r.p_without_country:.4g} | {r.all_country_omissions_same_sign} |')
    lines+=['','## Global comparisons with supplied exposures','',
            f"{int(global_results.status.eq('ok').sum())} eligible world-series tests; {int(global_results.q_bh.lt(.05).sum())} pass their separately corrected HAC threshold. These comparisons sum reported exposure counts and therefore retain the expanding-coverage problem. Results and Darts ARIMAX checks are in global_tests.csv. They are secondary descriptive checks, not evidence of a consistent historical global exposure.",'',
            '![Reporting coverage](reporting_coverage.png)','','## Method and limits','',
            '1. Use all observed country-year outcome pairs in 1997–2025, official World Bank country codes, and reported country fatalities/event counts. No interpolation. Outcomes are annual differences; positive economic levels and mortality/incidence series labeled log use 100 × log differences. Shares use percentage-point differences. Sparse surveys such as Gini and physician counts often cannot provide consecutive annual changes.',
            '2. Exposure is change in log(1 + reported fatalities/events per 100,000 population), examined at lags 0, 1, 2. Calendar grids are created before differencing and lagging, so missing years do not collapse time. To reduce partial-first-year effects, the first allowable exposure change is two years after a country’s first reported year. Intermittent missing reporting remains missing.',
            '3. Regress standardized outcome changes on standardized exposure changes with country and year fixed effects, absorbing them by alternating projections. This controls persistent differences in growth between countries and common year shocks. It does not establish causality, solve endogenous reporting, or control all time-varying confounders. Each country-year has equal weight, not population weight.',
            '4. Two-sided coefficient tests use a country + year − country-year two-way clustered sandwich covariance, finite-sample correction accounting for absorbed effects, and Student t with min(country clusters, year clusters)−1 degrees of freedom. Minimum 300 observations, 30 countries, 15 years; iterative singleton removal. Nonpositive variance or insufficient samples are flagged, not assigned significant p-values.',
            '5. BH FDR and Holm correction cover every eligible outcome × exposure × lag panel test. Overlapping exposure results are dependent, not separate replications. Added markers and country-level methods were chosen after an earlier unsuccessful global screen; this entire exercise is exploratory, with no independent confirmation sample.',
            '6. Secondary global tests use longest continuous runs of at least 20 annual changes, a linear time trend, two-sided HAC tests with bandwidth 2, and separate BH correction. Darts ARIMA(1,0,0) on changes with trend and exposure covariates checks an alternative AR(1) error model. The global model family is distinct from the country panel; do not combine their p-values as replications.',
            '7. Some health, employment and nutrition indicators are modeled or smoothed estimates rather than new annual measurements. National-account shares can change because their GDP denominator changes. Results are associations with measured changes, not intervention effect sizes.','',
            '## Files and reproduction','',
            'Run `python analysis/fetch_expanded_markers.py`, then `python analysis/expanded_country_analysis.py`. Dependencies are the existing analysis environment. Raw API responses, exact definitions, marker shortlist, source hashes, mapping audit, full test tables, influence checks and charts are saved here. Original source/metadata files are verified unchanged.','',
            'Sources: [World Bank indicator catalog](https://data.worldbank.org/indicator), [World Bank health indicators](https://data.worldbank.org/topic/8), [two-way clustered covariance reference](https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_cluster_2groups.html).','']
    global_sig=global_results[global_results.q_bh.lt(.05)].sort_values('q_bh')
    extra=['## Global findings and robustness','',
           'The global associations below pass their own multiple-testing correction, but the strongest civilian-targeting associations shrink markedly when pandemic outcome years are omitted. None of these selected associations passes FDR in the fixed-country sensitivity. That sensitivity measures a regional cohort against world outcomes, so it does not prove the worldwide relationship is absent; it shows the conclusion is not stable across the available reporting samples.','',
           '| Outcome | Exposure | Lag | Original r | HAC p | BH q | r omitting 2020–2021 | Fixed-cohort r | Fixed-cohort q |',
           '|---|---|---:|---:|---:|---:|---:|---:|---:|']
    for r in global_sig.itertuples():
        extra.append(f'| {r.label} | {r.metric} | {r.lag} | {r.partial_r:+.3f} | {r.p:.4g} | {r.q_bh:.4g} | {r.no_pandemic_response_r:+.3f} | {r.fixed_cohort_r:+.3f} | {r.fixed_cohort_q_bh:.4g} |')
    extra+=['','![Global robustness comparisons](global_robustness.png)','',
            'Fixed cohorts contain countries with a reported row in every year 1997–2025, selected separately for each exposure; their identities reflect historical reporting coverage. Rates use those countries’ population sums. The no-pandemic column refits the linear trend after omitting outcome years 2020–2021 and reports a descriptive correlation only; it does not collapse those gaps for an ARIMA fit.','']
    where=lines.index('## Method and limits')
    lines[where:where]=extra
    content=readable_tables('\n'.join(lines), best, checks, global_results)
    if (OUT/'time_series/index.md').exists():
        content += '\n\n## Relationship time-series graphs\n\n[View all nine relationships, raw series and lag-aligned changes](time_series/index.md) · [Download PDF](time_series/relationship_time_series.pdf)\n\n![Time-series overview](time_series/time_series_overview.png)\n'
    (OUT/'report.md').write_text(content)


def main():
    before=hashes()
    panel=prepare()
    changes=transformed_panel(panel)
    changes.to_pickle(OUT/'country_year_changes.pkl')
    results,pairs=country_models(changes)
    global_results=global_models(panel)
    checks=sensitivity(results,changes)
    best=figures(results,pairs)
    global_figure(global_results)
    report(results,global_results,checks,best)
    assert all(hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest for name,digest in before.items())
    (OUT/'manifest.json').write_text(json.dumps({'source_hashes':before,'original_files_unchanged':True,
        'analysis_script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'api_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (OUT/'raw').glob('*.json')},
        'panel_status_counts':results.status.value_counts().to_dict()},indent=2))
    print(best[['label','metric','lag','n','partial_r','p','q_bh','p_holm']].to_string(index=False))


if __name__=='__main__':
    main()
