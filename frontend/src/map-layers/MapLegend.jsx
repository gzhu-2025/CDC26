import { legendRows, scaleFor } from './scales.js'
import './map.css'

/** Legend for the active layer, built from the /map/metrics entry (label, unit, meaning). */
export default function MapLegend({ metric, info, asOf }) {
  if (!info) return null
  const rows = legendRows(metric)
  const diverging = scaleFor(metric).kind === 'diverging'
  return (
    <aside className="map-legend" aria-label={`Legend: ${info.label}`}>
      <div className="lg-title">{info.label}</div>
      <div className="lg-unit">{info.unit}</div>
      <ul>
        {[...rows].reverse().map((r) => (
          <li key={r.label}>
            <span className="lg-swatch" style={{ background: r.color }} />
            {diverging ? <span className="lg-word">{r.arrow} {r.word}</span> : <span>{r.label}</span>}
          </li>
        ))}
        <li className="lg-sep">
          <span className="lg-swatch" style={{ background: 'var(--land)' }} />
          <span>No data</span>
        </li>
        <li>
          <span className="lg-swatch hatch" />
          <span>Low confidence</span>
        </li>
      </ul>
      {asOf && <div className="lg-asof">ACLED data as of {asOf}</div>}
    </aside>
  )
}
