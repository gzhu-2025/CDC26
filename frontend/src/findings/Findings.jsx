import Reveal from '../site/Reveal.jsx'
import { DurationBars, EffectPath, MiniWar, MonthlyBars, TierBars } from '../charts/Charts.jsx'
import { people2, signedPct } from '../charts/base.js'
import './findings.css'

const MINUS = '−'
const pctRange = (lo, hi) => `${signedPct(lo)} to ${signedPct(hi)}`
const people = (v) => people2.format(Math.max(0, v))

function RankedList({ items, fmt, onPick, label }) {
  return (
    <ol className="ranked" aria-label={label}>
      {items.map((it, i) => (
        <li key={it.iso3}>
          <button type="button" onClick={() => onPick(it.iso3)}>
            <span className="rk-n">{i + 1}</span>
            <span className="rk-name">{it.name}</span>
            <span className="rk-value">{fmt(it.mid)}</span>
            <span className="rk-range">range {fmt(it.lo)} to {fmt(it.hi)}</span>
            {it.sources?.length > 0 && <span className="rk-src">from {it.sources.join(', ')}</span>}
          </button>
        </li>
      ))}
    </ol>
  )
}

function Sentences({ sentences }) {
  return <div className="sentences">{sentences.map((s) => <p key={s}>{s}</p>)}</div>
}

function Section({ s, index, children }) {
  return (
    <Reveal id={s.id} className={`finding ${index % 2 ? 'alt' : ''}`} aria-labelledby={`${s.id}-h`}>
      <div className="finding-inner">
        <h2 id={`${s.id}-h`}>{s.heading}</h2>
        <Sentences sentences={s.sentences} />
        {children}
        {s.how_we_know && <p className="how">How we know: {s.how_we_know}</p>}
      </div>
    </Reveal>
  )
}

function Body({ s, onShowOnMap }) {
  const c = s.chart
  switch (s.id) {
    case 'world_now':
      return (
        <>
          <figure className="figure">
            <figcaption className="fig-cap">{c.unit}, last 36 months</figcaption>
            <MonthlyBars data={c.data} summary={s.sr_summary} />
          </figure>
          <div className="stat-row">
            <div className="stat"><span className="stat-n">↑ {s.stats.escalating}</span> escalating</div>
            <div className="stat"><span className="stat-n">→ {s.stats.stable}</span> stable</div>
            <div className="stat"><span className="stat-n">↓ {s.stats.calming}</span> calming</div>
            <button type="button" className="link-btn" onClick={() => onShowOnMap('escalation_3m')}>
              See them on the map
            </button>
          </div>
        </>
      )
    case 'war_effect':
      return (
        <figure className="figure wide">
          <figcaption className="fig-cap">{c.unit}; shaded band = 90% range</figcaption>
          <EffectPath {...c} summary={s.sr_summary} />
        </figure>
      )
    case 'longer_wars':
      return (
        <figure className="figure">
          <figcaption className="fig-cap">{c.unit}, by length of war</figcaption>
          <DurationBars items={c.items} summary={s.sr_summary} />
        </figure>
      )
    case 'borders':
      return (
        <>
          <div className="big-number">
            <span className="bn-value">{signedPct(s.number.mid)}</span>
            <span className="bn-text">a neighbor's GDP per person, 10 years after one year of fighting next door (range {pctRange(s.number.lo, s.number.hi)})</span>
          </div>
          <h3 className="list-h">Most exposed right now</h3>
          <RankedList items={c.items} label="Most exposed countries" fmt={(v) => `${v < 0 ? MINUS : '+'}${Math.abs(v).toFixed(1)}%`}
            onPick={(iso3) => onShowOnMap('neighbor_exposure', iso3)} />
        </>
      )
    case 'poverty':
      return (
        <>
          <div className="big-number">
            <span className="bn-value">{people(s.number.mid)}</span>
            <span className="bn-text">more people below $2.15 a day if today's conflicts continue five years (range {people(s.number.lo)} to {people(s.number.hi)})</span>
          </div>
          {c.items.length > 0 && (
            <>
              <h3 className="list-h">Largest numbers</h3>
              <RankedList items={c.items} label="Countries with most people pushed into poverty" fmt={people}
                onPick={(iso3) => onShowOnMap('extra_poor_h5', iso3)} />
            </>
          )}
        </>
      )
    case 'heterogeneity':
      return c && (
        <table className="cand">
          <caption className="fig-cap">{c.rule}</caption>
          <thead><tr><th scope="col">Model</th><th scope="col">Better than simple model</th><th scope="col">90% range coverage</th><th scope="col">Passed</th></tr></thead>
          <tbody>
            {c.candidates.map((k) => (
              <tr key={k.variant}>
                <th scope="row">{k.variant === 'interactions' ? 'Resource rents + aid' : 'Regional shrinkage'}</th>
                <td>{k.wins_vs_pooled} of {k.n_wars} wars</td>
                <td>{Math.round(k.coverage_90 * 100)}% (simple: {Math.round(k.pooled_coverage_90 * 100)}%)</td>
                <td>{k.passes ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'backtest':
      return c && (
        <>
          <div className="stat-row">
            <div className="stat"><span className="stat-n">{Math.round(s.scorecard.coverage_90 * 100)}%</span> inside the 90% range</div>
            <div className="stat"><span className="stat-n">{s.scorecard.wins_vs_no_war} of {s.scorecard.n_wars}</span> beat "assume no war"</div>
          </div>
          <div className="legend-inline" aria-hidden="true">
            <span><i className="k actual" /> what happened</span>
            <span><i className="k war" /> predicted with war (range shaded)</span>
            <span><i className="k nowar" /> predicted without war</span>
          </div>
          <div className="multiples">
            {c.wars.map((w) => (
              <figure key={`${w.iso3}-${w.start}`} className={`multiple ${w.inside ? '' : 'out'}`}>
                <figcaption>
                  <span className="mw-name">{w.name} {w.start}</span>
                  <span className={`mw-tag ${w.tag}`}>{w.tag}</span>
                  <span className="mw-sub">
                    {w.duration}-year war · {Math.abs(w.off_pct) < 1 ? 'matched the prediction' : `reality ${Math.abs(w.off_pct).toFixed(0)}% ${w.off_pct > 0 ? 'better' : 'worse'}`} · {w.inside ? 'inside range' : 'outside range'}
                  </span>
                </figcaption>
                <MiniWar war={w} />
              </figure>
            ))}
          </div>
        </>
      )
    case 'limits':
      return (
        <figure className="figure">
          <figcaption className="fig-cap">{c.unit}</figcaption>
          <TierBars tiers={c.tiers} summary={s.sentences[1]} />
        </figure>
      )
    case 'about':
      return (
        <p className="about-link">
          <button type="button" className="link-btn" onClick={() => document.getElementById('limits')?.scrollIntoView({ behavior: 'smooth' })}>
            Read the methods and limits
          </button>
        </p>
      )
    default:
      return null
  }
}

export default function Findings({ findings, onShowOnMap }) {
  return (
    <>
      {findings.sections.map((s, i) => (
        <Section key={s.id} s={s} index={i}>
          <Body s={s} onShowOnMap={onShowOnMap} />
        </Section>
      ))}
      <footer className="site-footer">
        <div className="finding-inner">
          <h2>Sources</h2>
          <ul>
            {findings.sources.map((src) => <li key={src.name}><b>{src.name}</b>: {src.detail} ({src.use}).</li>)}
          </ul>
          <p>Model estimated on {findings.estimated_on}. ACLED data last updated {findings.acled_as_of}.
            {findings.lowo_on && ` Out-of-sample test run on ${findings.lowo_on}.`}</p>
          <p>Estimates are associational, not proof of cause.</p>
        </div>
      </footer>
    </>
  )
}
