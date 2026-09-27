"""Plot saved significant results without rerunning or selecting new tests."""
import os

os.environ.setdefault('MPLCONFIGDIR', '/private/tmp/cdc26-mpl')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.ticker import MaxNLocator
import numpy as np
import pandas as pd

from expanded_country_analysis import OUT, wb_frame
from fetch_expanded_markers import ALL_MARKERS
from conflict_indicators import longest_run
from social_health_analysis import partial_fit

DEST = OUT / 'time_series'
EXPOSURES = {'civilian_targeting':'Events targeting civilians', 'demonstrations':'Demonstration events'}
UNITS = {
    'SH.XPD.CHEX.GD.ZS':'% of GDP', 'SN.ITK.DEFC.ZS':'% of population',
    'SH.IMM.IDPT':'% of children ages 12–23 months',
    'SH.XPD.OOPC.CH.ZS':'% of current health expenditure', 'IT.NET.USER.ZS':'% of population',
    'NE.CON.PRVT.PC.KD':'Constant 2015 US$ per person',
    'SL.UEM.TOTL.ZS':'% of labor force', 'BX.KLT.DINV.WD.GD.ZS':'% of GDP',
    'SP.DYN.IMRT.IN':'Deaths per 1,000 live births',
}
BLUE, ORANGE = '#176b9b', '#c55a20'


def series_for(row):
    dates = pd.date_range('1997','2025',freq='YS')
    coverage = pd.read_csv(OUT/'conflict_coverage.csv')
    count = coverage[coverage.metric.eq(row.metric)].set_index('year').reported_count
    count.index = pd.to_datetime(count.index.astype(str),format='%Y')
    population = wb_frame('SP.POP.TOTL').query("iso3 == 'WLD'").set_index('year').value
    population.index = pd.to_datetime(population.index.astype(str),format='%Y')
    rate = (count/population*1e5).reindex(dates)
    outcome = wb_frame(row.code).query("iso3 == 'WLD'").set_index('year').value
    outcome.index = pd.to_datetime(outcome.index.astype(str),format='%Y')
    outcome = outcome.reindex(dates)
    transform = next(m[3] for m in ALL_MARKERS if m[1] == row.code)
    dy = (100*np.log(outcome.where(outcome>0)) if transform=='log' else outcome).diff()
    dx = 100*np.log1p(rate).diff()
    pair = longest_run(pd.DataFrame({'y':dy, 'x':dx.shift(row.lag)}))
    fit, residuals, _, _ = partial_fit(pair)
    assert len(pair) == row.n
    assert np.isclose(residuals.corr().loc['x','y'],row.partial_r,atol=1e-10)
    assert np.isclose(fit.pvalues.iloc[1],row.p,rtol=1e-8)
    export = pd.DataFrame({'reported_events':count, 'events_per_100k_world_population':rate,
                           'outcome_level':outcome, 'outcome_change':dy,
                           'exposure_change_at_response_year':dx.shift(row.lag),
                           'exposure_change_detrended_standardized':residuals.x,
                           'outcome_change_detrended_standardized':residuals.y})
    export.index.name='outcome_year_date'
    export['aligned_exposure_year']=export.index.year-row.lag
    return rate,outcome,residuals,export


def annotate(ax, lag=0, alignment=False):
    ax.axvspan(2019.5,2021.5,color='#9299a1',alpha=.16,zorder=0)
    ax.axvline(2018+lag if alignment else 2018,color='#8c5388',linestyle=':',linewidth=1.2)
    ax.grid(axis='y',alpha=.2)
    ax.xaxis.set_major_locator(MaxNLocator(integer=True,nbins=8))
    ax.spines[['top','right']].set_visible(False)


def detail(row, rate, outcome, residuals):
    fig,axes=plt.subplots(3,1,figsize=(12,10),layout='constrained')
    fig.suptitle(f'{EXPOSURES[row.metric]} and {row.label.lower()}\n'
                 f'Exposure leads by {row.lag} year(s) | r = {row.partial_r:+.3f} | '
                 f'p = {row.p:.3g} | adjusted q = {row.q_bh:.4f} | n = {row.n}',fontsize=15)
    axes[0].plot(rate.index.year,rate,color=BLUE,marker='o',markersize=3,lw=1.8)
    axes[0].set(title='A. Reported exposure rate — original calendar years',
                ylabel='Recorded events / 100,000\nWorld Bank world population',xlabel='Exposure year')
    axes[1].plot(outcome.index.year,outcome,color=ORANGE,marker='o',markersize=3,lw=1.8)
    axes[1].set(title=f'B. {row.label} — official world aggregate, original calendar years',
                ylabel=UNITS[row.code],xlabel='Outcome year')
    axes[2].plot(residuals.index.year,residuals.x,color=BLUE,lw=1.8,marker='o',markersize=3,
                 label=f'Exposure change {row.lag} year(s) earlier')
    axes[2].plot(residuals.index.year,residuals.y,color=ORANGE,lw=1.8,marker='o',markersize=3,
                 label='Outcome change in displayed year')
    axes[2].axhline(0,color='black',lw=.6)
    axes[2].set(title='C. Exact series used for the correlation — lag aligned and detrended',
                ylabel='Standardized annual changes\nafter linear trend removal',xlabel='Outcome year (exposure shifted forward to match lag)')
    axes[2].legend(loc='best',fontsize=9)
    for ax in axes[:2]:
        annotate(ax)
    annotate(axes[2],row.lag,True)
    fig.supxlabel('Gray band: outcome/calendar years 2020–2021. Purple dotted line: 2018 reporting expansion; shifted by the lag in panel C.\n'
                  'Raw panels are descriptive. Reported exposure coverage changes over time; q does not establish causation or robustness.\n'
                  f'Correlation omitting pandemic outcome years: {row.no_pandemic_response_r:+.3f}; '
                  f'fixed reporting-cohort sensitivity: {row.fixed_cohort_r:+.3f} (regional exposure).',fontsize=9)
    return fig


def main():
    DEST.mkdir(exist_ok=True)
    results=pd.read_csv(OUT/'global_tests.csv')
    selected=results[results.q_bh.lt(.05)].sort_values('q_bh')
    selected.to_csv(DEST/'plotted_relationships.csv',index=False)
    plt.rcParams.update({'font.size':10,'axes.titlesize':11})
    fig,axes=plt.subplots(3,3,figsize=(17,12),layout='constrained')
    links=[]
    with PdfPages(DEST/'relationship_time_series.pdf') as pdf:
        for ax,row in zip(axes.flat,selected.itertuples()):
            rate,outcome,residuals,export=series_for(row)
            stem=f'{row.code}_{row.metric}_lag{row.lag}'
            export.to_csv(DEST/f'{stem}.csv')
            page=detail(row,rate,outcome,residuals)
            page.savefig(DEST/f'{stem}.png',dpi=160)
            page.savefig(DEST/f'{stem}.svg')
            pdf.savefig(page)
            plt.close(page)
            ax.plot(residuals.index.year,residuals.x,color=BLUE,lw=1.6,marker='o',markersize=2)
            ax.plot(residuals.index.year,residuals.y,color=ORANGE,lw=1.6,marker='o',markersize=2)
            ax.axhline(0,color='black',lw=.5)
            annotate(ax,row.lag,True)
            ax.set(title=f'{row.label}\n{EXPOSURES[row.metric]}: lag {row.lag}\n'
                   f'r = {row.partial_r:+.2f}; q = {row.q_bh:.4f}',xlabel='Outcome year',ylabel='Detrended standardized change')
            links.append((row,stem))
        for ax in axes.flat[len(selected):]:
            ax.set_visible(False)
        fig.suptitle('Time series for all nine global associations passing FDR\n'
                     'Blue: earlier exposure change • Orange: outcome change • No axis inversion for negative correlations',fontsize=16)
        fig.supxlabel('Gray: 2020–2021. Purple dotted line: 2018 reporting expansion shifted to the outcome year by the tested lag.\n'
                      'These exploratory global associations are sensitive to sample choices; none is confirmed by the corrected country-level screen.',fontsize=10)
        fig.savefig(DEST/'time_series_overview.png',dpi=170)
        fig.savefig(DEST/'time_series_overview.svg')
        pdf.savefig(fig)
        plt.close(fig)
    text=['# Time series of significant global relationships','',
          'These plots reproduce the nine global relationships with BH q < 0.05 from the existing analysis. No additional tests or model selection were performed. Each detailed figure shows the original exposure rate, the original outcome level, and the exact lag-aligned changes used in the reported test.','',
          '[Download the complete PDF](relationship_time_series.pdf) · [Selected results](plotted_relationships.csv)','',
          '![Time-series overview](time_series_overview.png)','',
          'The comparison panels standardize each change series within its model sample and remove a linear calendar-year trend. Positive/negative directions are preserved. A year on these panels refers to the outcome year; the blue exposure comes from one or two years earlier, as labeled. Raw panels retain actual dates, units and missing values. No interpolation or extra smoothing is applied.','',
          'The gray band marks 2020–2021. The purple line flags the 2018 expansion in reporting; in aligned panels it appears at 2018 plus the tested lag. This is context, not a statistical estimate of a break date. Raw rates divide reported events by world population and should not be interpreted as complete global incidence.','',
          '## Individual relationships','']
    for row,stem in links:
        text += [f'### {row.label}', '',
                 f'{EXPOSURES[row.metric]}, {row.lag}-year lag. r = {row.partial_r:+.3f}, p = {row.p:.6g}, q = {row.q_bh:.4f}, n = {row.n}.', '',
                 f'![{row.label} time series]({stem}.png)','',
                 f'[SVG]({stem}.svg) · [Plotted data]({stem}.csv)','']
    (DEST/'index.md').write_text('\n'.join(text))
    report=OUT/'report.md'
    content=report.read_text()
    heading='## Relationship time-series graphs'
    if heading in content:
        content=content[:content.index(heading)].rstrip()
    content += '\n\n'+heading+'\n\n[View all nine relationships, raw series and lag-aligned changes](time_series/index.md) · [Download PDF](time_series/relationship_time_series.pdf)\n\n![Time-series overview](time_series/time_series_overview.png)\n'
    report.write_text(content)
    print(f'Created {len(links)} detailed PNG/SVG figures, overview, 10-page PDF and plotted-data CSVs. All correlations/p-values match saved tests.')


if __name__=='__main__':
    main()
