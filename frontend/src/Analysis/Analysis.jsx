
import React from 'react';
import data from '../findingsData.js';
import { MonthlyBars, EffectPath, DurationBars, TierBars, MiniWar } from '../charts/Charts.jsx';


export default function Analysis() {
  const sources = data.sources || [];

  return (
    <div style={{ padding: '2rem', textAlign: 'left', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h1>Analysis & Resources</h1>

      {/* Section: world_now */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>The world right now</h2>
        <p style={{ lineHeight: '1.6' }}>In the last 12 months, about 210,000 people were killed in political violence worldwide.</p>
        <p style={{ lineHeight: '1.6' }}>That is 22% fewer than the 12 months before.</p>
        <p style={{ lineHeight: '1.6' }}>43 countries are at war by our definition; in the last three months, 12 are escalating and 26 are calming.</p>
        <figure style={{ margin: '2rem 0' }}>
          <figcaption style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>political-violence deaths per month, worldwide, last 36 months</figcaption>
          <MonthlyBars data={data.sections[0].chart.data} summary={data.sections[0].sr_summary} />
        </figure>
        <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: ACLED records for 237 countries and territories, as of 2026-09-12. Escalating or calming compares the last 3 months with the 3 before, only for countries with at least 25 deaths across those 6 months; the current month is left out until it is complete. Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: war_effect */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>What war does to an economy</h2>
        <p style={{ lineHeight: '1.6' }}>One year after a year of fighting like Iraq's war with ISIS, we can't distinguish the effect on GDP per person from zero at this horizon.</p>
        <p style={{ lineHeight: '1.6' }}>Five years after a year of fighting like Iraq's war with ISIS, we can't distinguish the effect on GDP per person from zero at this horizon.</p>
        <p style={{ lineHeight: '1.6' }}>Ten years after a year of fighting like Iraq's war with ISIS, we can't distinguish the effect on GDP per person from zero at this horizon.</p>
        <p style={{ lineHeight: '1.6' }}>In the years before these wars, economies were not already sliding: the pre-war years sit near zero.</p>
        <figure style={{ margin: '2rem 0' }}>
          <figcaption style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>% GDP per person vs no war; shaded band = 90% range</figcaption>
          <EffectPath {...data.sections[1].chart} summary={data.sections[1].sr_summary} />
        </figure>
        <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: Local projections on 153 countries, 1990-2023, 1000 country-resampled draws; the band is the 90% range. Associational: it shows what usually comes with war, not proof of cause. Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: longer_wars */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>Longer wars</h2>
        <p style={{ lineHeight: '1.6' }}>Even for a 10-year war, we can't distinguish the 10-year effect from zero.</p>
        <p style={{ lineHeight: '1.6' }}>The data can't tell whether later years of a war hurt less than the first.</p>
        <figure style={{ margin: '2rem 0' }}>
          <figcaption style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>% GDP per person after 10 years, by length of war</figcaption>
          <DurationBars items={data.sections[2].chart.items} summary={data.sections[2].sr_summary} />
        </figure>
        <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: Adds up each war year's effect, with a term letting later years of a war hurt less. The long-war term is estimated from wars of very different lengths; it is imprecise. Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: borders */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>It crosses borders</h2>
        <p style={{ lineHeight: '1.6' }}>Ten years after a year of civil-war-level fighting next door (500 km away), we can't distinguish the effect on a neighbor's GDP per person from zero at this horizon.</p>
        <p style={{ lineHeight: '1.6' }}>Right now, Syrian Arab Republic is the most exposed to fighting in nearby countries.</p>
        <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: Neighbor effects weight fighting by distance between capitals (falls off over ~500 km). Capital-to-capital distance is a rough proxy for where fighting actually happens. Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: poverty */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>Who falls into poverty</h2>
        <p style={{ lineHeight: '1.6' }}>If today's conflicts continued five years, our middle estimate is about 18 million more people below $2.15 a day across 65 countries, but the range runs from no increase to 66 million, so we can't rule out no change.</p>
        <p style={{ lineHeight: '1.6' }}>The largest share would be in Nigeria.</p>
        <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: Poverty follows GDP with an assumed elasticity; 65 countries with conflict and a poverty survey. The world total adds country ranges end to end (they share the same model draws). 11 countries are left out because their last survey is over 10 years old. Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: heterogeneity */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>Does it differ by country?</h2>
        <p style={{ lineHeight: '1.6' }}>The test of whether war hurts some economies more has not been run yet.</p>
        <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: Two models were pre-registered (backend/PREREGISTRATION.md) and scored on held-out wars. A model had to be better on at least 20 of 29 wars and give better-calibrated ranges. Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: backtest */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>How well does the model do?</h2>
        <p style={{ lineHeight: '1.6' }}>The out-of-sample test has not been run yet.</p>
        <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know:   Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: about */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>About this site</h2>
        <p style={{ lineHeight: '1.6' }}>This site estimates how armed conflict changes a country's economy, and shows where conflict is happening now.</p>
        <p style={{ lineHeight: '1.6' }}>It learns from what happened to income per person in 153 countries between 1990 and 2023, then applies those patterns to today's fighting.</p>
        <p style={{ lineHeight: '1.6' }}>Method in one line: compare each country's path after conflict with its own pre-war trend, across many wars at once.</p>
        <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know:   Estimated on 2026-09-26.
        </p>
      </div>

      {/* Section: limits */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>Methods and limits</h2>
        <p style={{ lineHeight: '1.6' }}>These are associations, not proof of cause: countries that go to war differ in many ways, and economic collapse can itself lead to war.</p>
        <p style={{ lineHeight: '1.6' }}>Data disappears in the worst wars: GDP figures are missing for 10% of country-years in the most intense conflicts, versus 2% in peacetime, so the worst cases are under-represented.</p>
        <p style={{ lineHeight: '1.6' }}>Foreign investment is too noisy to estimate: at no horizon can we distinguish the effect of war from zero, so we don't show it.</p>
        <p style={{ lineHeight: '1.6' }}>ACLED's records start in different years by region (from 1996 for the earliest to 2021 for the most recently added places), so recent trends are more reliable than long histories.</p>
        <p style={{ lineHeight: '1.6' }}>Recent conflict deaths come from ACLED and are converted to the battle-death scale the model was built on: 1 ACLED battle death counts as 0.57 (middle half of country-years 0.33 to 0.87), fitted on 537 country-years, 68% of them in Africa.</p>
        <figure style={{ margin: '2rem 0' }}>
          <figcaption style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>% of country-years with no data</figcaption>
          <TierBars tiers={data.sections[8].chart.tiers} summary={data.sections[8].sentences[1]} />
        </figure>
        <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em', marginTop: '1rem' }}>
          How we know: Missing-data shares use 5,202 country-years, 1990-2023; 'most intense' means at least 19 battle deaths per 100k.  Estimated on 2026-09-26.
        </p>
      </div>

      {/* Resources Section */}
      <div style={{ marginTop: '4rem', marginBottom: '2rem', paddingTop: '2rem', borderTop: '2px solid #ccc' }}>
        <h2>Resources & Data Sources</h2>
        <p style={{ marginBottom: '1rem' }}>The following data sources were used in this analysis:</p>
        <ul style={{ lineHeight: '1.8' }}>
          {sources.map((s, idx) => (
            <li key={idx}>
              <strong>{s.name}</strong> - {s.detail}
              <br/>
              <em style={{ color: '#555' }}>Used for: {s.use}</em>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
