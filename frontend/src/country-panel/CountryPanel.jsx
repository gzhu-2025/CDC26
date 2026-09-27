import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { getCountrySummary } from '../map-layers/engineApi.js'
import { fmtRange, fmtValue } from '../map-layers/format.js'
import { describe } from '../map-layers/scales.js'
import Sparkline from './Sparkline.jsx'
import './panel.css'

const BADGE = {
  ok: { text: 'Reasonable confidence', cls: 'ok' },
  low: { text: 'Low confidence', cls: 'low' },
  none: { text: 'No data', cls: 'none' },
}

function Stat({ label, value, extra, children }) {
  return (
    <div className="cp-stat">
      <div className="cp-stat-label">{label}</div>
      <div className="cp-stat-value">{value}{extra && <span className="cp-stat-extra"> {extra}</span>}</div>
      {children}
    </div>
  )
}

function CostCard({ metric, row, title, explain, emphasized }) {
  const range = fmtRange(metric, row)
  const missing = !row || row.value == null
  return (
    <div className={`cp-card ${emphasized ? 'emph' : ''} ${missing ? 'missing' : ''}`}>
      <div className="cp-card-title">{title}</div>
      <div className="cp-card-value">{missing ? 'Not available' : fmtValue(metric, row.value)}</div>
      <div className="cp-card-range">
        {missing ? (row?.note ? capitalize(row.note) : 'Not enough data.') : range ? `range ${range}` : ' '}
      </div>
      <div className="cp-card-explain">{explain}</div>
    </div>
  )
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function Skeleton() {
  return (
    <div className="cp-skeleton" aria-hidden="true">
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk sk-line short" />
      <div className="sk sk-block" />
      <div className="sk-grid"><div className="sk sk-card" /><div className="sk sk-card" /><div className="sk sk-card" /><div className="sk sk-card" /></div>
    </div>
  )
}

/**
 * Country panel: right drawer on desktop, bottom sheet on mobile.
 * Closes with the X, Esc, the browser Back button (via the route) or a map click.
 */
export default function CountryPanel({ iso3, onClose, returnFocusTo }) {
  const [state, setState] = useState({ iso3: null, body: null, error: null })
  const panelRef = useRef(null)
  const open = Boolean(iso3)

  useEffect(() => {
    if (!iso3) return
    let alive = true
    getCountrySummary(iso3)
      .then((body) => alive && setState({ iso3, body, error: null }))
      .catch((e) => alive && setState({ iso3, body: null, error: e }))
    return () => { alive = false }
  }, [iso3])

  // focus into the panel on open; back to the map on close
  const wasOpen = useRef(false)
  useEffect(() => {
    // focus the panel itself: it persists while content swaps from skeleton to data
    if (open) panelRef.current?.focus({ preventScroll: true })
    else if (wasOpen.current) returnFocusTo?.()?.focus?.({ preventScroll: true })
    wasOpen.current = open
  }, [open, iso3, returnFocusTo])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const ready = state.iso3 === iso3 && (state.body || state.error)
  const d = ready ? state.body?.data : null
  const m = d?.metrics ?? {}
  const badge = BADGE[d?.confidence ?? 'none']
  const esc = describe('escalation_3m', m.escalation_3m?.value)
  const unrest = describe('unrest_z', m.unrest_z?.value)
  const intensityForExplorer = m.cost_continue_h5?.inputs?.intensity_per_100k_ucdp_equiv

  return (
    <aside
      className={`cp-panel ${open ? 'open' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cp-title"
      aria-hidden={!open}
      tabIndex={-1}
      ref={panelRef}
    >
      <button type="button" className="cp-close" onClick={onClose} aria-label="Close country panel">
        <X size={20} />
      </button>

      {!ready && open && (
        <>
          <h2 id="cp-title" className="cp-visually-hidden">Loading {iso3}</h2>
          <Skeleton />
        </>
      )}

      {ready && state.error && (
        <div className="cp-body">
          <h2 id="cp-title">{iso3}</h2>
          <p className="cp-headline">
            {state.error.status === 404 ? 'This area is not a country we have data for.' : `Could not load this country (${state.error.message}).`}
          </p>
        </div>
      )}

      {d && (
        <div className="cp-body">
          <header className="cp-header">
            <h2 id="cp-title">{d.name}</h2>
            <div className="cp-meta">
              <span>Data as of {d.as_of}</span>
              <span className={`cp-badge ${badge.cls}`}>
                {badge.cls === 'low' && <span className="cp-hatch" aria-hidden="true" />}
                {badge.text}
              </span>
            </div>
          </header>

          <p className="cp-headline">{d.headline}</p>

          <section aria-labelledby="cp-now">
            <h3 id="cp-now">Now</h3>
            <div className="cp-stats">
              <Stat label="Deadly violence" value={fmtValue('intensity_12m', m.intensity_12m?.value)}
                extra={m.intensity_12m?.value != null ? 'deaths per 100k, last 12 months' : null} />
              <Stat label="Last 3 months vs the 3 before"
                value={esc ? <span className={`cp-trend ${esc.word.replace(' ', '-')}`}>{esc.arrow} {esc.word}</span> : '–'} />
              <Stat label="Protests and riots"
                value={unrest ? `${unrest.arrow} ${unrest.word}` : '–'}
                extra={m.unrest_z?.value != null ? `(${fmtValue('unrest_z', m.unrest_z.value)} sd vs 3-year norm)` : null} />
            </div>
            <div className="cp-spark-wrap">
              <div className="cp-stat-label">Political-violence deaths per month, last 36 months</div>
              <Sparkline points={d.fatalities_36m} />
            </div>
          </section>

          <section aria-labelledby="cp-cost">
            <h3 id="cp-cost">Cost</h3>
            <div className="cp-cards">
              <CostCard metric="peace_dividend_h5" row={m.peace_dividend_h5} emphasized
                title="Gain from stopping now"
                explain="Income per person saved after 5 years if fighting stops after this year, instead of 4 more years." />
              <CostCard metric="cost_continue_h5" row={m.cost_continue_h5}
                title="Cost if fighting continues"
                explain="GDP per person after 5 years, compared with no war." />
              <CostCard metric="extra_poor_h5" row={m.extra_poor_h5}
                title="People pushed into poverty"
                explain="Extra people below $2.15 a day after 5 years if fighting continues." />
              <CostCard metric="neighbor_exposure" row={m.neighbor_exposure}
                title="Neighborhood exposure"
                explain="Income lost after 5 years from fighting in nearby countries." />
            </div>
          </section>

          {state.body.warnings.length > 0 && (
            <section aria-labelledby="cp-notes">
              <h3 id="cp-notes">Keep in mind</h3>
              <ul className="cp-warnings">
                {state.body.warnings.map((w) => <li key={w.code}>{w.message}</li>)}
              </ul>
            </section>
          )}

          <a className="cp-explore" href={`/explorer.html#${d.iso3}${intensityForExplorer ? `?i=${intensityForExplorer.toPrecision(3)}` : ''}`}>
            Explore scenarios
          </a>

          <footer className="cp-footer">
            <p>Sources: {d.sources.join(' · ')}.</p>
            <p>Estimates are associational, not proof of cause.</p>
          </footer>
        </div>
      )}
    </aside>
  )
}
