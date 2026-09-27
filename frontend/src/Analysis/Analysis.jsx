import findings from '../findingsData.js';
import backtest from '../data/backtestData.js';
import { EffectPath, DurationBars, TierBars, MiniWar } from '../charts/Charts.jsx';
import './Analysis.css';

// Analysis page: can the numbers reject "war has no measurable effect"?
// Every figure here comes from real data: our model (findingsData, backtestData), World Bank WDI,
// and ACLED/UCDP. Images are produced by analysis/expanded_country_analysis.py and analysis/blind_spots/.

const section = (id) => findings.sections.find((s) => s.id === id);
const warEffect = section('war_effect');
const longerWars = section('longer_wars');
const limits = section('limits');

// strongest worldwide associations from analysis/expanded_analysis (trend-adjusted, HAC errors)
const ASSOCIATIONS = [
  { marker: 'Adult literacy', category: 'Social', lag: 2, r: -0.501, p: 0.0276, q: 0.8287 },
  { marker: 'Internet use', category: 'Social', lag: 2, r: -0.282, p: 0.232, q: 0.9108 },
  { marker: 'Primary school completion', category: 'Social', lag: 2, r: -0.244, p: 0.1043, q: 0.9108 },
  { marker: 'Inflation', category: 'Economic', lag: 0, r: 0.242, p: 0.0345, q: 0.8287 },
  { marker: 'Health spending / GDP', category: 'Healthcare', lag: 1, r: -0.205, p: 0.3136, q: 0.9108 },
  { marker: 'Life expectancy', category: 'Healthcare', lag: 0, r: -0.132, p: 0.0036, q: 0.2407 },
];

function Figure({ src, alt, caption }) {
  return (
    <figure className="analysis-figure">
      <img src={`/analysis_img/${src}`} alt={alt} className="analysis-img" />
      <figcaption className="analysis-figcaption">{caption}</figcaption>
    </figure>
  );
}

function ChartFigure({ caption, children }) {
  return (
    <figure className="analysis-figure">
      <figcaption className="analysis-figcaption">{caption}</figcaption>
      {children}
    </figure>
  );
}

export default function Analysis() {
  const bt = backtest.summary;
  return (
    <div className="page analysis-container">
      <h1>Can the numbers see war?</h1>
      <p className="analysis-lede">
        Every test on this page starts from the same assumption, the <strong>null hypothesis</strong>: war has no measurable effect on a
        country's statistics. The question is whether the data is strong enough to reject it. For income in long, intense wars, it is.
        For almost everything else, it is not, and the reasons say as much about the data as about war.
      </p>

      {/* 1. GDP */}
      <section className="analysis-section">
        <h2 className="analysis-header">1. Income: where the null breaks, and where it doesn't</h2>
        <h3 className="analysis-sub">The clearest cases: long wars</h3>
        <p className="analysis-p">
          In Syria, real income per person ended up 61% below where its pre-war trend was heading. Yemen ended 38% below, Libya 37%.
          Against the year before the war, Syria lost 53%, Yemen 45% and Libya 33%. Effects this large are impossible to miss.
        </p>
        <Figure
          src="gdp_collapse.png"
          alt="Real GDP per person in Syria, Yemen and Libya against each country's pre-war trend; all three fall 37 to 61 percent below trend."
          caption="Real GDP per person (constant 2015 US$), year before the war = 100, against the average growth of the 5 years before. Yemen's World Bank series stops in 2018."
        />

        <h3 className="analysis-sub">The typical war: indistinguishable from zero</h3>
        <p className="analysis-p">
          Averaged across every war since 1990, the picture blurs. Our model compares each country's path after fighting starts with its own
          pre-war trend. It finds a drop of about 10% in the year fighting starts, but from the next year on the range includes zero: we can't
          tell the typical war's effect apart from no effect. Before the wars, economies were not already sliding, which is a good sign the
          method itself is sound.
        </p>
        <ChartFigure caption={`${warEffect.chart.unit}, for a year of fighting like Iraq's war with ISIS. Line = middle estimate, band = 90% range.`}>
          <EffectPath {...warEffect.chart} summary={warEffect.sr_summary} />
        </ChartFigure>
        <p className="analysis-p">
          Longer wars add up to bigger middle estimates, about −26% after a 10-year war, but even then the range still reaches above zero.
        </p>
        <ChartFigure caption={`${longerWars.chart.unit}, by length of war. Whiskers = 90% range.`}>
          <DurationBars items={longerWars.chart.items} summary={longerWars.sr_summary} />
        </ChartFigure>

        <h3 className="analysis-sub">Does knowing about the war help predict income?</h3>
        <p className="analysis-p">
          We hid each of {bt.n_wars} past wars from the model, one at a time, and asked it to predict what happened. A forecast that knows about
          the war beat a simple forecast that ignores it in only <strong>{bt.wins_vs_no_war} of {bt.n_wars}</strong> wars, and reality fell
          inside the model's 90% range {Math.round(bt.coverage_90 * 100)}% of the time rather than 90%. It helps for the big, long wars
          (Syria, Yemen, Libya) and not for the short ones.
        </p>
        <div className="mini-grid">
          {backtest.wars.map((w) => (
            <div key={`${w.name}-${w.start}`} className="mini-card">
              <div className="mini-title">{w.name}, {w.start}</div>
              <div className="mini-verdict">{w.war_beats_nowar ? 'War forecast closer' : 'Ignoring the war did as well'}</div>
              <MiniWar war={w} />
            </div>
          ))}
        </div>
        <p className="analysis-figcaption">
          GDP per person, current US$. <span className="key actual">Black</span> = what happened, <span className="key war">red</span> = forecast
          with the war (band = 90% range), <span className="key nowar">green</span> = forecast ignoring the war. Six of the 29 held-out wars.
        </p>
      </section>

      {/* 2. Missing data */}
      <section className="analysis-section">
        <h2 className="analysis-header">2. Missing data: the worst wars are the least measured</h2>
        <p className="analysis-p">
          The countries with the most violence have the least data. In the most violent country-years, 69% of education indicators and 90% of
          poverty indicators are missing, against 42% and 72% in calm ones. Compared with its own calmer years, a country at war loses only a
          little more (about 8 points more for education, a borderline result, and no clear difference for the others): the places war hits
          hardest were already the least measured. Every test below therefore runs mostly on the countries that suffered least.
        </p>
        <Figure
          src="missing_by_conflict.png"
          alt="Share of World Bank indicators missing by conflict level: economy 11% calm vs 26% severe, health 26% vs 34%, education 42% vs 69%, poverty 72% vs 90%."
          caption="Share of World Bank indicators missing, by political-violence deaths per 100,000 people that year. 2,223 country-years across 213 countries, 1997–2023."
        />
        <p className="analysis-p">
          Even GDP, the best-kept statistic, thins out in the worst fighting: it is missing for about 10% of country-years in the most intense
          wars, against 2% in peacetime. Poverty surveys are missing for 94%.
        </p>
        <ChartFigure caption={`${limits.chart.unit}, by conflict level (battle deaths, 1990–2023).`}>
          <TierBars tiers={limits.chart.tiers} summary="GDP and poverty data missing by conflict level" />
        </ChartFigure>
        <p className="analysis-p">
          The violence data has gaps of its own. It covered 48 countries until 2009 and over 200 by 2021, so a rise in recorded violence can
          simply mean more countries are being watched.
        </p>
        <Figure
          src="reporting_coverage.png"
          alt="Number of countries in the violence data by year: about 48 until 2009, rising to over 200 by 2021."
          caption="Countries with a record in the violence data each year."
        />
      </section>

      {/* 3. Removing years */}
      <section className="analysis-section">
        <h2 className="analysis-header">3. Remove two years and the strongest results fall apart</h2>
        <p className="analysis-p">
          Nine worldwide links between violence and health, spending and jobs did pass a statistical correction at first. Most of them come
          from two unrelated events lining up. In 2018 the violence data jumped from 77 to 148 countries, so recorded violence nearly doubled
          overnight. Tested with a two-year delay, that jump lands on 2020, when the pandemic moved almost every health and economic figure at
          once. One year of coincidence produces a strong-looking correlation.
        </p>
        <p className="analysis-p">
          Leave out 2020–2021 and they shrink: consumption per person goes from −0.75 to −0.12, out-of-pocket health spending from −0.75
          to −0.15, health spending from +0.70 to +0.23, unemployment from +0.69 to +0.23. Using only countries recorded every year weakens
          them further, and some flip sign.
        </p>
        <h3 className="analysis-sub">Example: violence against civilians and unemployment</h3>
        <p className="analysis-p">
          This pair looked like one of the strongest results: a correlation of +0.69 between events targeting civilians and world unemployment
          two years later. But 2020 alone accounts for about three quarters of it. Without 2020 it falls to +0.35; without 2018–2022, the
          expansion and pandemic years, it is −0.04. The same pair shows nothing with no delay or a one-year delay, and nothing when each
          country is compared with itself (correlations near 0.01 across about 1,800 country-years). Violence may well cost local jobs,
          but a world average dominated by large, peaceful economies cannot show it.
        </p>
        <Figure
          src="global_robustness.png"
          alt="Bar chart: worldwide associations that passed correction shrink or flip when 2020 to 2021 are left out or when only countries recorded every year are used."
          caption="Blue: all data. Orange: without 2020–2021. Green: only countries recorded in every year. A real effect would keep its size and direction across all three."
        />
        <p className="analysis-p">
          The few that hold up are not clean evidence either. Internet use rises with recorded protests because better internet means more
          protests get recorded. Undernourishment rises with protests, but hunger more likely drives protests than the other way round.
          Infant mortality rising two years after protests keeps its size in all three versions, but it rests on about 25 yearly points
          worldwide and does not appear among the country-level results: a lead worth testing, not a finding.
        </p>
      </section>

      {/* 4. Everything else */}
      <section className="analysis-section">
        <h2 className="analysis-header">4. Everything else looks like noise</h2>
        <p className="analysis-p">
          We tested 36 health, education, social and economic measures against five measures of violence, at three time lags: 473 tests with
          enough data. None held up after correcting for the number of tests.
        </p>
        <Figure
          src="correlation_heatmap.png"
          alt="Heatmap of correlations between yearly changes in world conflict and 24 measures at 0, 1 and 2 year lags; most cells are pale, near zero."
          caption="How closely each worldwide measure moved with conflict, the same year and one or two years later. Red = rose with conflict, blue = fell."
        />
        <p className="analysis-p">
          A real, consistent effect would show up as a dark row. Instead the grid is mostly pale, most values fall between −0.15 and +0.15,
          and the larger ones change sign from one lag to the next, which is what noise looks like.
        </p>
        <Figure
          src="strongest_scatterplots.png"
          alt="Six scatterplots of the strongest worldwide associations, each with 20 to 36 yearly points and a fitted line pulled by one or two extreme years."
          caption="The six strongest worldwide associations. Each dot is one year."
        />
        <p className="analysis-p">
          Even the strongest cases rest on 20 to 36 yearly points, and single years pull the lines. Adult literacy looks like the biggest effect,
          but it rests almost entirely on 1997; without that point the line is flat.
        </p>
        <Figure
          src="country_scatterplots.png"
          alt="Six scatterplots of country-year changes; thousands of points form a cloud centred on zero with nearly flat fitted lines."
          caption="The strongest country-level associations. Each dot is one country in one year."
        />
        <p className="analysis-p">
          With thousands of country-years, the picture is a cloud centred on zero. The fitted lines are nearly flat (correlations of 0.03 to
          0.13), and none passes the correction. This comparison, each country against its own other years, is the one the expanding
          violence data cannot fool, because a country only counts once it is being recorded.
        </p>
        <Figure
          src="country_effects.png"
          alt="Estimated effects for the 12 strongest country-level associations; all are close to zero, between −0.18 and +0.11."
          caption="The 12 strongest of 473 country-level tests. Dots = estimated effect, bars = 95% range for each test on its own. Ranges this tight still don't count once you correct for running 473 tests: none passes (smallest corrected q = 0.13)."
        />
        <p className="analysis-p">
          Even the best of 473 tests are tiny: the largest, real consumption and life expectancy, explain about 2–3% of the variation, and
          most explain well under 1%. With this many tests, a dozen results this size are what chance alone would produce.
        </p>
        <details className="analysis-details">
          <summary>Full table: strongest worldwide associations</summary>
          <p className="analysis-p">
            Partial r is the correlation after removing a time trend. The q-value corrects for the number of tests; below 0.05 would count as
            evidence. None comes close.
          </p>
          <div className="analysis-table-wrap">
            <table className="analysis-table">
              <thead>
                <tr><th>Measure</th><th>Category</th><th>Lag (years)</th><th>Partial r</th><th>p-value</th><th>q-value</th></tr>
              </thead>
              <tbody>
                {ASSOCIATIONS.map((a) => (
                  <tr key={a.marker}>
                    <td>{a.marker}</td><td>{a.category}</td><td>{a.lag}</td>
                    <td>{a.r > 0 ? '+' : '−'}{Math.abs(a.r).toFixed(3)}</td><td>{a.p}</td><td>{a.q}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="analysis-p">
          Part of the reason is how these figures are made. Several World Bank health, nutrition and employment series are modelled or smoothed
          between occasional surveys, so a sudden wartime shock is spread across years or never appears. Literacy and inequality are surveyed
          years apart, leaving too few year-to-year changes to test.
        </p>
      </section>

      {/* 5. Conclusion */}
      <section className="analysis-section">
        <h2 className="analysis-header">What this means</h2>
        <p className="analysis-p">
          Failing to reject the null hypothesis is not the same as proving it. War's damage to health, schooling and poverty almost certainly
          exists. The statistics simply cannot see it: they are thinnest exactly where the damage is greatest, smoothed where shocks happen,
          and easily swamped by events like the pandemic. Where the effect is large and the data survives, as with income in Syria, Yemen and
          Libya, war shows up plainly.
        </p>
      </section>

      {/* 6. Methods and sources */}
      <section className="analysis-section">
        <h2 className="analysis-header">Methods and sources</h2>
        <ul className="analysis-list">
          <li>
            <strong>Income collapse:</strong> World Bank GDP per person in constant 2015 US$ (NY.GDP.PCAP.KD), against each country's average
            growth in the 5 years before the war.
          </li>
          <li>
            <strong>Model and backtest:</strong> local projections with country and year fixed effects on 153 countries, 1990–2023, war intensity
            from UCDP battle deaths; 90% ranges from a cluster bootstrap. The backtest re-estimates the model without each war in turn.
            Estimated on {findings.estimated_on}.
          </li>
          <li>
            <strong>Missing data:</strong> World Bank WDI indicators in years covered by the violence data, compared raw and with country and
            year fixed effects, errors clustered by country.
          </li>
          <li>
            <strong>Screening tests:</strong> annual changes with country and year fixed effects (country level) or a linear trend with HAC errors
            (worldwide), with Benjamini–Hochberg and Holm corrections across every eligible test.
          </li>
          <li>All results are associations, not proof of cause: countries that go to war differ in many ways, and economic collapse can itself lead to war.</li>
        </ul>
        <ul className="analysis-list">
          {findings.sources.map((s) => (
            <li key={s.name}><strong>{s.name}</strong>: {s.detail}. Used for {s.use}.</li>
          ))}
        </ul>
        <p className="how-we-know">
          Scripts: backend/ (model and backtest), analysis/expanded_country_analysis.py (screening tests), analysis/blind_spots/ (income
          collapse and missing data).
        </p>
      </section>
    </div>
  );
}
