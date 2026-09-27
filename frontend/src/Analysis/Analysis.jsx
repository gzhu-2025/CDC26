
import React from 'react';
import data from '../findingsData.js';
import { MonthlyBars, EffectPath, DurationBars, TierBars, MiniWar } from '../charts/Charts.jsx';
import './Analysis.css';
import { CrossCountryExplorer } from './CrossCountryExplorer.jsx';


export default function Analysis() {
  const sources = data.sources || [];

  return (
    <div style={{ padding: '2rem', textAlign: 'left', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h1>Analysis & Resources</h1>

      {/* Section: world_now */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>The world right now</h2>
        <p style={{ lineHeight: '1.6' }}>In the last 12 months, about 210,000 people were killed in political violence worldwide.</p>
        <p style={{ lineHeight: '1.6' }}>That is 22% fewer than the 12 months before.</p>
        <p style={{ lineHeight: '1.6' }}>43 countries are at war by our definition; in the last three months, 12 are escalating and 26 are calming.</p>
        <figure style={{ margin: '2rem 0' }}>
          <figcaption style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: '8px' }}>political-violence deaths per month, worldwide, last 36 months</figcaption>
          <MonthlyBars data={data.sections[0].chart.data} summary={data.sections[0].sr_summary} />
        </figure>
        <p style={{ fontStyle: 'italic', color: 'var(--text)', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: ACLED records for 237 countries and territories, as of 2026-09-12. Escalating or calming compares the last 3 months with the 3 before, only for countries with at least 25 deaths across those 6 months; the current month is left out until it is complete. Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: poverty */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Who falls into poverty</h2>
        <p style={{ lineHeight: '1.6' }}>If today's conflicts continued five years, our middle estimate is about 18 million more people below $2.15 a day across 65 countries, but the range runs from no increase to 66 million, so we can't rule out no change.</p>
        <p style={{ lineHeight: '1.6' }}>The largest share would be in Nigeria.</p>
        <p style={{ fontStyle: 'italic', color: 'var(--text)', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: Poverty follows GDP with an assumed elasticity; 65 countries with conflict and a poverty survey. The world total adds country ranges end to end (they share the same model draws). 11 countries are left out because their last survey is over 10 years old. Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: about */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>About this site</h2>
        <p style={{ lineHeight: '1.6' }}>This site estimates how armed conflict changes a country's economy, and shows where conflict is happening now.</p>
        <p style={{ lineHeight: '1.6' }}>It learns from what happened to income per person in 153 countries between 1990 and 2023, then applies those patterns to today's fighting.</p>
        <p style={{ lineHeight: '1.6' }}>Method in one line: compare each country's path after conflict with its own pre-war trend, across many wars at once.</p>
        <p style={{ fontStyle: 'italic', color: 'var(--text)', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know:   Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: limits */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Methods and limits</h2>
        <p style={{ lineHeight: '1.6' }}>These are associations, not proof of cause: countries that go to war differ in many ways, and economic collapse can itself lead to war.</p>
        <p style={{ lineHeight: '1.6' }}>Data disappears in the worst wars: GDP figures are missing for 10% of country-years in the most intense conflicts, versus 2% in peacetime, so the worst cases are under-represented.</p>
        <p style={{ lineHeight: '1.6' }}>Foreign investment is too noisy to estimate: at no horizon can we distinguish the effect of war from zero, so we don't show it.</p>
        <p style={{ lineHeight: '1.6' }}>ACLED's records start in different years by region (from 1996 for the earliest to 2021 for the most recently added places), so recent trends are more reliable than long histories.</p>
        <p style={{ lineHeight: '1.6' }}>Recent conflict deaths come from ACLED and are converted to the battle-death scale the model was built on: 1 ACLED battle death counts as 0.57 (middle half of country-years 0.33 to 0.87), fitted on 537 country-years, 68% of them in Africa.</p>
        <figure style={{ margin: '2rem 0' }}>
          <figcaption style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: '8px' }}>% of country-years with no data</figcaption>
          <TierBars tiers={data.sections[8].chart.tiers} summary={data.sections[8].sentences[1]} />
        </figure>
        <p style={{ fontStyle: 'italic', color: 'var(--text)', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: Missing-data shares use 5,202 country-years, 1990-2023; 'most intense' means at least 19 battle deaths per 100k.  Estimated on 2026-09-26.
        </p>
      </div>

      
      
      {/* Section: Interactive Explorer */}
      <CrossCountryExplorer />
      
      
      {/* Section: Third Teammate's Expanded Statistical Analysis */}
      <div style={{ marginTop: '4rem', marginBottom: '2.5rem', paddingTop: '2rem', borderTop: '2px solid var(--border)' }}>
        <h2 className="analysis-header" style={{ fontSize: '1.8rem', color: 'var(--text-h)' }}>Expanded Statistical Health & Social Analysis</h2>
        <p className="analysis-p">
          To validate these economic indicators, our team screened 36 non-conflict outcomes (including social, economic, and healthcare markers) across a global panel, testing 540 prespecified combinations using Autoregressive Distributed Lag (ARDL) and ARIMAX error models.
        </p>

        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '2rem', marginBottom: '1rem', color: 'var(--text-h)' }}>Strongest Associations</h3>
        <p className="analysis-p">
          Ranked by absolute trend-adjusted correlation. A large correlation is not automatically statistically significant. Negative associations indicate the outcome degrades as conflict escalates.
        </p>
        
        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: 'var(--text)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-h)' }}>
                <th style={{ padding: '8px' }}>Marker</th>
                <th style={{ padding: '8px' }}>Category</th>
                <th style={{ padding: '8px' }}>Lag</th>
                <th style={{ padding: '8px' }}>Partial r</th>
                <th style={{ padding: '8px' }}>HAC p-val</th>
                <th style={{ padding: '8px' }}>BH q-val</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>Adult literacy</td>
                <td style={{ padding: '8px' }}>Social</td>
                <td style={{ padding: '8px' }}>2</td>
                <td style={{ padding: '8px', color: '#B10026', fontWeight: 'bold' }}>-0.501</td>
                <td style={{ padding: '8px' }}>0.0276</td>
                <td style={{ padding: '8px' }}>0.8287</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>Internet use</td>
                <td style={{ padding: '8px' }}>Social</td>
                <td style={{ padding: '8px' }}>2</td>
                <td style={{ padding: '8px', color: '#B10026' }}>-0.282</td>
                <td style={{ padding: '8px' }}>0.2320</td>
                <td style={{ padding: '8px' }}>0.9108</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>Primary school completion</td>
                <td style={{ padding: '8px' }}>Social</td>
                <td style={{ padding: '8px' }}>2</td>
                <td style={{ padding: '8px', color: '#B10026' }}>-0.244</td>
                <td style={{ padding: '8px' }}>0.1043</td>
                <td style={{ padding: '8px' }}>0.9108</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>Inflation</td>
                <td style={{ padding: '8px' }}>Economic</td>
                <td style={{ padding: '8px' }}>0</td>
                <td style={{ padding: '8px', color: '#1A9850', fontWeight: 'bold' }}>+0.242</td>
                <td style={{ padding: '8px' }}>0.0345</td>
                <td style={{ padding: '8px' }}>0.8287</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>Health spending / GDP</td>
                <td style={{ padding: '8px' }}>Healthcare</td>
                <td style={{ padding: '8px' }}>1</td>
                <td style={{ padding: '8px', color: '#B10026' }}>-0.205</td>
                <td style={{ padding: '8px' }}>0.3136</td>
                <td style={{ padding: '8px' }}>0.9108</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', fontWeight: 600 }}>Life expectancy</td>
                <td style={{ padding: '8px' }}>Healthcare</td>
                <td style={{ padding: '8px' }}>0</td>
                <td style={{ padding: '8px', color: '#B10026' }}>-0.132</td>
                <td style={{ padding: '8px' }}>0.0036</td>
                <td style={{ padding: '8px' }}>0.2407</td>
              </tr>
            </tbody>
          </table>
        </div>

        <figure className="analysis-figure" style={{ marginTop: '3rem' }}>
          <img src="/analysis_img/correlation_heatmap.png" alt="Correlation Heatmap" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} />
          <figcaption className="analysis-figcaption" style={{ marginTop: '8px' }}>Global correlation heatmap across all 24 prespecified social and economic markers.</figcaption>
        </figure>

        <figure className="analysis-figure" style={{ marginTop: '3rem' }}>
          <img src="/analysis_img/strongest_scatterplots.png" alt="Strongest Associations" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} />
          <figcaption className="analysis-figcaption" style={{ marginTop: '8px' }}>Scatterplots detailing the strongest empirical deviations (e.g. Adult Literacy vs Conflict Intensity).</figcaption>
        </figure>

        <figure className="analysis-figure" style={{ marginTop: '3rem' }}>
          <img src="/analysis_img/country_scatterplots.png" alt="Country Specific Shocks" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} />
          <figcaption className="analysis-figcaption" style={{ marginTop: '8px' }}>Country-specific panel scatterplots detailing targeted civilian fatalities vs health system shocks.</figcaption>
        </figure>

        <p className="how-we-know">
          Data and transformations: Analysis screened 36 non-conflict outcomes using official World Bank WDI aggregates and UCDP OrganizedViolenceCY v26.1 datasets. Standardized test is two-sided, Student-t reference with Newey-West/HAC covariance, Bartlett kernel, and finite-sample covariance correction.
        </p>
      </div>

      {/* Resources Section */}
      <div style={{ marginTop: '4rem', marginBottom: '2rem', paddingTop: '2rem', borderTop: '2px solid var(--border)' }}>
        <h2>Resources & Data Sources</h2>
        <p style={{ marginBottom: '1rem' }}>The following data sources were used in this analysis:</p>
        <ul style={{ lineHeight: '1.8' }}>
          {sources.map((s, idx) => (
            <li key={idx}>
              <strong>{s.name}</strong> - {s.detail}
              <br/>
              <em style={{ color: 'var(--text)' }}>Used for: {s.use}</em>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
