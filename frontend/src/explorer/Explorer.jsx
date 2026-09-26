import { useEffect, useMemo, useState } from 'react'
import { getCountries, getHistory, getPresets, simulate } from './api.js'
import Chart, { Legend } from './Chart.jsx'
import { conflictEpisodes, fmt } from './format.js'

const COLORS = {
  actual: 'var(--ink-series)',
  noWar: 'var(--series-1)',
  war: 'var(--series-2)',
  deaths: 'var(--series-8)',
}
const DURATIONS = [1, 3, 5, 10]
const HORIZON = 10

function readHash() {
  const iso = window.location.hash.replace('#', '').toUpperCase()
  return /^[A-Z0-9]{3}$/.test(iso) ? iso : 'KEN'
}

const align = (years, lookup) => years.map((y) => lookup.get(y) ?? null)
const toMap = (years, values) => new Map(years.map((y, i) => [y, values[i]]))

export default function Explorer() {
  const [countries, setCountries] = useState([])
  const [presets, setPresets] = useState([])
  const [iso3, setIso3] = useState(readHash)
  const [history, setHistory] = useState(null)
  const [scenario, setScenario] = useState({ kind: 'preset', key: 'civil_war', duration: 5 })
  const [sim, setSim] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    getCountries()
      .then((r) => setCountries(
        r.data.filter((c) => c.coverage['NY.GDP.PCAP.KD'].n_obs >= 10)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ))
      .catch((e) => setError(`Can't reach the engine (${e.message}). Is the API running on port 8000?`))
    getPresets().then((r) => setPresets(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    window.location.hash = iso3
    getHistory(iso3).then(setHistory).catch((e) => setError(e.message))
  }, [iso3])

  const h = history?.data?.iso3 === iso3 ? history.data : null
  const episodes = useMemo(() => (h ? conflictEpisodes(h, 2).filter((e) => e.start >= 1995) : []), [h])
  const nextYear = useMemo(() => {
    if (!h) return null
    const withGdp = h.years.filter((y, i) => h.gdp_pc[i] != null)
    return withGdp[withGdp.length - 1] + 1
  }, [h])

  // Resolve the chosen scenario into simulator parameters.
  const params = useMemo(() => {
    if (!h) return null
    if (scenario.kind === 'replay') {
      const ep = episodes.find((e) => e.start === scenario.start)
      if (ep) {
        return {
          onset_year: ep.start,
          duration_years: Math.min(10, ep.duration),
          intensity_per_100k: Math.max(0.1, Number(ep.intensity.toPrecision(3))),
        }
      }
    }
    const p = presets.find((q) => q.key === scenario.key)
    if (!p) return null
    return { onset_year: nextYear, duration_years: scenario.duration, intensity_per_100k: p.intensity_per_100k }
  }, [h, scenario, presets, episodes, nextYear])

  useEffect(() => {
    if (!params) return
    const t = setTimeout(() => {
      setLoading(true)
      simulate({ iso3, ...params, horizon: HORIZON, n_sims: 5000, seed: 7 })
        .then((r) => { setSim(r); setError(null) })
        .catch((e) => { setSim(null); setError(e.message) })
        .finally(() => setLoading(false))
    }, 150)
    return () => clearTimeout(t)
  }, [iso3, params])

  const name = h?.name ?? countries.find((c) => c.iso3 === iso3)?.name ?? iso3
  const current = sim?.data?.iso3 === iso3 ? sim : null

  return (
    <div className="viz-root">
      <div className="page">
        <header className="hero">
          <p className="eyebrow">Conflict impact simulator</p>
          <h1>
            What would a war cost{' '}
            <select className="country-select" value={iso3} onChange={(e) => setIso3(e.target.value)} aria-label="Country">
              {!countries.some((c) => c.iso3 === iso3) && <option value={iso3}>{name}</option>}
              {countries.map((c) => <option key={c.iso3} value={c.iso3}>{c.name}</option>)}
            </select>
            ?
          </h1>
        </header>

        {error && <div className="notice error">{error}</div>}

        <ScenarioPicker
          presets={presets}
          episodes={episodes}
          scenario={scenario}
          setScenario={setScenario}
          name={name}
        />

        {current && h ? (
          <Result sim={current} h={h} name={name} scenario={scenario} hover={hover} onHover={setHover} loading={loading} />
        ) : (
          <div className="placeholder">{loading ? 'Simulating…' : 'Loading…'}</div>
        )}

        {h && (
          <details className="history">
            <summary>See {name}'s history since 1990</summary>
            <HistoryCharts h={h} episodes={episodes} hover={hover} onHover={setHover} />
          </details>
        )}
      </div>
    </div>
  )
}

function ScenarioPicker({ presets, episodes, scenario, setScenario, name }) {
  const replaying = scenario.kind === 'replay'
  return (
    <section className="picker" aria-label="Scenario">
      <div className="picker-row">
        <h2 className="step">What kind of war?</h2>
        <div className="cards">
          {presets.map((p) => {
            const active = !replaying && scenario.key === p.key
            return (
              <button
                key={p.key}
                className={`card ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => setScenario({ kind: 'preset', key: p.key, duration: replaying ? 5 : scenario.duration })}
              >
                <span className="card-title">{p.label}</span>
                <span className="card-like">like {p.like}</span>
              </button>
            )
          })}
        </div>
      </div>

      {!replaying && (
        <div className="picker-row">
          <h2 className="step">How long does it last?</h2>
          <div className="segmented" role="radiogroup" aria-label="Duration">
            {DURATIONS.map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={scenario.duration === d}
                className={scenario.duration === d ? 'on' : ''}
                onClick={() => setScenario({ ...scenario, duration: d })}
              >
                {d} {d === 1 ? 'year' : 'years'}
              </button>
            ))}
          </div>
        </div>
      )}

      {episodes.length > 0 && (
        <div className="picker-row replay">
          <span className="muted">Or replay {name}'s real war and compare with what happened:</span>
          {episodes.slice(-3).map((e) => {
            const active = replaying && scenario.start === e.start
            return (
              <button
                key={e.start}
                className={`chip ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => setScenario({ kind: 'replay', start: e.start })}
              >
                {e.start === e.end ? e.start : `${e.start}–${e.end}`}
              </button>
            )
          })}
          {replaying && (
            <button className="chip ghost" onClick={() => setScenario({ kind: 'preset', key: 'civil_war', duration: 5 })}>
              Back to a hypothetical war
            </button>
          )}
        </div>
      )}
    </section>
  )
}

const FRIENDLY = {
  CURRENTLY_AT_WAR: (w, name) => `${name} is already in conflict. This shows the added cost of a new war of this size.`,
  ALREADY_AT_WAR: (w, name) => `${name} was already at war, so this is modeled as the war continuing.`,
  SHORT_GDP_HISTORY: () => 'This country has little economic data, so treat the result with extra caution.',
  INTENSITY_OUT_OF_SAMPLE: () => 'This war is more intense than almost any in our data, so the estimate is a stretch.',
  BASELINE_TREND_FALLBACK: () => 'Not enough data for a full forecast; the no-war path uses a simple trend.',
}

function Result({ sim, h, name, scenario, hover, onHover, loading }) {
  const d = sim.data
  const hl = d.headline
  const gap = hl.gdp_pc_gap_pct
  const years = d.years
  const last = years[years.length - 1]
  const first = Math.max(1990, d.onset_year - 12)
  const x = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const actual = toMap(h.years, h.gdp_pc)
  const replay = scenario.kind === 'replay'

  // No-war / with-war lines branch from the last real value before the war.
  const anchorYear = [...actual.keys()].filter((y) => y < d.onset_year && actual.get(y) != null).pop()
  const branch = (vals) => {
    const m = toMap(years, vals)
    if (anchorYear != null && d.onset_year - anchorYear <= 5) m.set(anchorYear, actual.get(anchorYear))
    return align(x, m)
  }
  const band = (k) => align(x, toMap(years, d.gdp_pc.scenario[k]))
  const gapPct = gap.p50
  const series = [
    { key: 'actual', label: 'What happened', color: COLORS.actual, values: align(x, actual), spanGaps: true, fmt: fmt.usd, endLabel: replay ? 'What happened' : null, weight: 'thin' },
    { key: 'nowar', label: 'Without war', color: COLORS.noWar, values: branch(d.gdp_pc.baseline.p50), spanGaps: true, fmt: fmt.usd, endLabel: 'Without war' },
    {
      key: 'war', label: 'With war', color: COLORS.war, values: branch(d.gdp_pc.scenario.p50), spanGaps: true, fmt: fmt.usd, endLabel: 'With war',
      band: { p5: band('p5'), p95: band('p95'), p25: band('p25'), p75: band('p75') },
    },
  ]
  const warYears = { start: d.conflict_years[0], end: d.conflict_years[d.conflict_years.length - 1] }

  const poorer = -gapPct
  const lo = -gap.p95
  const hi = -gap.p5
  const recentPoverty = d.baseline_assumptions.poverty_year && d.onset_year - d.baseline_assumptions.poverty_year <= 10
  const extraPoor = recentPoverty ? hl.extra_people_in_poverty : null

  const actualEnd = [...actual.entries()].filter(([y, v]) => y >= d.onset_year && y <= last && v != null).pop()
  const baseAt = actualEnd && toMap(years, d.gdp_pc.baseline.p50).get(actualEnd[0])
  const actualGap = actualEnd && baseAt ? (actualEnd[1] / baseAt - 1) * 100 : null

  const notes = sim.warnings.map((w) => FRIENDLY[w.code]?.(w, name)).filter(Boolean)
  const bt = sim.meta.backtest
  const neighbors = d.neighbors.filter((n) => Math.abs(n.gdp_pc_gap_pct.p50) >= 0.1).slice(0, 6)
  const maxNb = Math.max(...neighbors.map((n) => Math.abs(n.gdp_pc_gap_pct.p50)), 1)

  return (
    <section className={`result ${loading ? 'is-loading' : ''}`} aria-live="polite">
      <div className="answer">
        <p className="answer-main">
          {poorer >= 1 ? (
            <>After {HORIZON} years, the average person in {name} would be about <strong>{Math.round(poorer)}% poorer</strong> than without the war.</>
          ) : (
            <>After {HORIZON} years, the average person in {name} would be <strong>about as well off</strong> as without the war.</>
          )}
        </p>
        <p className="answer-sub">
          That's roughly <strong>{fmt.usd(hl.cumulative_gdp_pc_loss_usd.p50)}</strong> less income per person over the decade.
          {' '}Likely range: {rangeText(lo, hi)}.
          {extraPoor && extraPoor.p50 >= 1000 && (
            <> About <strong>{fmt.people(extraPoor.p50).replace('+', '')}</strong> more people could fall into extreme poverty (rough estimate).</>
          )}
        </p>
        {replay && actualGap != null && (
          <p className="answer-sub">
            What really happened: by {actualEnd[0]}, GDP per person was <strong>{Math.abs(Math.round(actualGap))}% {actualGap < 0 ? 'below' : 'above'}</strong> our no-war path.
          </p>
        )}
        {notes.map((n) => <p key={n} className="note">{n}</p>)}
      </div>

      <div className="panel main-chart">
        <div className="panel-head">
          <h3>Income per person</h3>
          <span className="muted small">GDP per person, constant 2015 US$</span>
        </div>
        <Legend items={[
          { label: 'Without war', color: COLORS.noWar },
          { label: 'With war (shaded: likely range)', color: COLORS.war },
          { label: 'What happened', color: COLORS.actual },
        ]} />
        <Chart
          x={x}
          series={series}
          shade={[warYears]}
          shadeLabel="War"
          yFormat={fmt.usd}
          height={340}
          hoverYear={hover}
          onHover={onHover}
          endLabels
          gap={{ upper: 'nowar', lower: 'war', text: `${Math.round(gapPct)}%` }}
          ariaLabel={`Income per person in ${name} with and without war`}
        />
      </div>

      <div className="two-col">
        {neighbors.length > 0 && (
          <div className="panel">
            <div className="panel-head"><h3>Neighbors feel it too</h3></div>
            <p className="muted small">Income per person after {HORIZON} years, compared with no war next door.</p>
            <ul className="bars">
              {neighbors.map((n) => (
                <li key={n.iso3}>
                  <span className="bar-label">{n.name}<span className="muted small"> · {Math.round(n.distance_km).toLocaleString()} km</span></span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${(Math.abs(n.gdp_pc_gap_pct.p50) / maxNb) * 100}%` }} /></span>
                  <span className="bar-value">{fmt.signedPct(n.gdp_pc_gap_pct.p50)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="panel">
          <div className="panel-head"><h3>How sure are we?</h3></div>
          {bt && (
            <p>
              We replayed <strong>{bt.n_episodes} past wars</strong>. The real outcome landed inside our likely range{' '}
              <strong>{Math.round(bt.hit_rate_90 * 100)}% of the time</strong>, so treat these numbers as a rough guide, not a forecast.
            </p>
          )}
          <p className="muted small">
            Based on what happened in about 150 countries since 1990. It shows what usually comes with a war,
            not proof that the war caused every change. Aid, sanctions and refugees can change the picture.
            No-war path: {d.baseline_assumptions.method}.
          </p>
        </div>
      </div>
    </section>
  )
}

function rangeText(lo, hi) {
  const part = (v) => (v >= 0 ? `${Math.round(v)}% poorer` : `${Math.round(-v)}% better off`)
  return `${part(lo)} to ${part(hi)}`
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {subtitle && <span className="muted small">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function HistoryCharts({ h, episodes, hover, onHover }) {
  const idx = h.years.map((y, i) => (y >= 1990 ? i : -1)).filter((i) => i >= 0)
  const x = idx.map((i) => h.years[i])
  const pick = (arr) => idx.map((i) => arr[i])
  const shade = episodes.map(({ start, end }) => ({ start, end }))
  const common = { x, shade, hoverYear: hover, onHover, height: 180 }
  return (
    <div className="grid">
      <Panel title="Income per person" subtitle="constant 2015 US$">
        <Chart {...common} series={[{ key: 'gdp', label: 'GDP per person', color: COLORS.noWar, values: pick(h.gdp_pc) }]} yFormat={fmt.usd} ariaLabel="GDP per person over time" />
      </Panel>
      <Panel title="Battle deaths" subtitle="per 100,000 people">
        <Chart
          {...common}
          series={[{ key: 'deaths', label: 'Deaths per 100k', color: COLORS.deaths, kind: 'columns', values: pick(h.deaths_per_100k).map((v) => v || null) }]}
          yFormat={fmt.num}
          yZero
          ariaLabel="Battle deaths per 100,000 people"
        />
      </Panel>
      <Panel title="Extreme poverty" subtitle="% below $2.15/day, from surveys">
        <Chart
          {...common}
          series={[{ key: 'pov', label: 'Poverty rate', color: COLORS.noWar, values: pick(h.poverty_rate), spanGaps: true, markers: true, fmt: fmt.pct }]}
          yFormat={fmt.pct}
          yZero
          ariaLabel="Extreme poverty rate"
        />
      </Panel>
    </div>
  )
}
