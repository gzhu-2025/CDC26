import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import { colorFor, describe, joinCode } from './scales.js'
import { fmtRange, fmtValue } from './format.js'

const GEO_URL = '/geo/ne_50m_admin_0_countries.geojson'
const HATCH_ID = 'lowconf-hatch'

// Leaflet writes fill colors into SVG attributes, where CSS var() does not work, so
// resolve theme tokens to concrete colors once (tokens.css stays the single source).
const tokenCache = new Map()
function resolve(color) {
  const m = /^var\((--[\w-]+)\)$/.exec(color)
  if (!m) return color
  if (!tokenCache.has(m[1])) {
    tokenCache.set(m[1], getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim())
  }
  return tokenCache.get(m[1])
}

/** Diagonal hatch <pattern> inside Leaflet's SVG renderer (for low-confidence countries). */
function useHatchPattern(ready) {
  const map = useMap()
  useEffect(() => {
    if (!ready) return
    const svg = map.getPanes().overlayPane.querySelector('svg')
    if (!svg || svg.querySelector(`#${HATCH_ID}`)) return
    const ns = 'http://www.w3.org/2000/svg'
    const defs = document.createElementNS(ns, 'defs')
    const pattern = document.createElementNS(ns, 'pattern')
    Object.entries({ id: HATCH_ID, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' })
      .forEach(([k, v]) => pattern.setAttribute(k, v))
    const line = document.createElementNS(ns, 'line')
    Object.entries({ x1: 0, y1: 0, x2: 0, y2: 6, stroke: resolve('var(--text)'), 'stroke-opacity': 0.32, 'stroke-width': 1.2 })
      .forEach(([k, v]) => line.setAttribute(k, v))
    pattern.appendChild(line)
    defs.appendChild(pattern)
    svg.insertBefore(defs, svg.firstChild)
  }, [map, ready])
}

function tooltipHtml(name, metric, row, info) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  if (!row || row.value == null) {
    return `<div class="tip-name">${esc(name)}</div><div class="tip-muted">No data${row?.note ? ` (${esc(row.note)})` : ''}</div>`
  }
  const d = describe(metric, row.value)
  const range = fmtRange(metric, row)
  return `<div class="tip-name">${esc(name)}</div>`
    + `<div class="tip-value">${esc(info?.label ?? metric)}: <b>${esc(fmtValue(metric, row.value))}</b>${d ? ` ${d.arrow} ${esc(d.word)}` : ''}</div>`
    + (range ? `<div class="tip-range">range ${esc(range)}</div>` : '')
    + (row.confidence === 'low' ? '<div class="tip-muted">Low confidence</div>' : '')
}

export default function ChoroplethLayer({ metric, values, info, selected, onSelect, onBackgroundClick }) {
  const [geo, setGeo] = useState(null)
  useEffect(() => {
    fetch(GEO_URL).then((r) => r.json()).then(setGeo).catch(() => setGeo(null))
  }, [])
  useHatchPattern(Boolean(geo))

  useMapEvents({ click: () => onBackgroundClick?.() })

  const lowConf = useMemo(() => {
    if (!geo || !values) return null
    return {
      ...geo,
      features: geo.features.filter((f) => values[joinCode(f.properties)]?.confidence === 'low'),
    }
  }, [geo, values])

  const selectedGeo = useMemo(() => {
    if (!geo || !selected) return null
    return { ...geo, features: geo.features.filter((f) => joinCode(f.properties) === selected) }
  }, [geo, selected])

  if (!geo) return null
  const border = resolve('var(--border)')

  return (
    <>
      <GeoJSON
        key={`fill-${metric}-${values ? 'v' : 'x'}`}
        data={geo}
        attribution="Boundaries: Natural Earth · Data: ACLED, World Bank, UCDP"
        style={(f) => ({
          fillColor: resolve(colorFor(metric, values?.[joinCode(f.properties)]?.value)),
          fillOpacity: 1,
          color: border,
          weight: 0.6,
        })}
        onEachFeature={(f, layer) => {
          const code = joinCode(f.properties)
          const name = f.properties.NAME
          layer.bindTooltip(() => tooltipHtml(name, metric, values?.[code], info), {
            sticky: true, className: 'map-tip', direction: 'top', offset: [0, -8],
          })
          layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e) // don't also fire the map's background click
            if (code) onSelect(code)
          })
          layer.on('mouseover', () => layer.setStyle({ weight: 1.4, color: resolve('var(--text-2)') }))
          layer.on('mouseout', () => layer.setStyle({ weight: 0.6, color: border }))
        }}
      />
      {lowConf && lowConf.features.length > 0 && (
        <GeoJSON
          key={`hatch-${metric}-${lowConf.features.length}`}
          data={lowConf}
          interactive={false}
          style={() => ({ stroke: false, fillColor: `url(#${HATCH_ID})`, fillOpacity: 1 })}
        />
      )}
      {selectedGeo && selectedGeo.features.length > 0 && (
        <>
          {/* dark halo under a bone-white outline: visible on every fill color */}
          <GeoJSON key={`halo-${selected}`} data={selectedGeo} interactive={false}
            style={() => ({ fill: false, color: resolve('var(--bg)'), weight: 4.5, opacity: 0.9 })} />
          <GeoJSON key={`sel-${selected}`} data={selectedGeo} interactive={false}
            style={() => ({ fill: false, color: resolve('var(--text)'), weight: 2 })} />
        </>
      )}
    </>
  )
}
