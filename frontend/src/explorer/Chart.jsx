import { useLayoutEffect, useRef, useState } from 'react'
import { niceTicks } from './format.js'

const LABEL_W = 132 // right gutter for direct end labels

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(600)
  // Measure synchronously before first paint, then track resizes.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(Math.max(280, Math.floor(el.getBoundingClientRect().width)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  return [ref, width]
}

/** Split into drawable runs of non-null points (or one run if spanGaps). */
function runs(x, values, spanGaps) {
  const pts = x.map((xv, i) => [xv, values?.[i]])
  const out = [[]]
  if (spanGaps) out[0] = pts.filter(([, v]) => v != null)
  else pts.forEach((p) => (p[1] == null ? out.push([]) : out[out.length - 1].push(p)))
  return out.filter((r) => r.length)
}

const linePath = (pts, sx, sy) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${sx(a)},${sy(b)}`).join('')

function areaPath(x, lo, hi, sx, sy) {
  const pts = x.map((xv, i) => [xv, lo?.[i], hi?.[i]]).filter(([, l, h]) => l != null && h != null)
  if (!pts.length) return ''
  const top = pts.map(([a, , h], i) => `${i ? 'L' : 'M'}${sx(a)},${sy(h)}`).join('')
  const bottom = [...pts].reverse().map(([a, l]) => `L${sx(a)},${sy(l)}`).join('')
  return `${top}${bottom}Z`
}

/** Column with 4px rounded data-end, square at the baseline. */
function columnPath(cx, w, yTop, yBase) {
  const h = yBase - yTop
  if (h <= 0.5) return ''
  const r = Math.min(4, w / 2, h)
  const x0 = cx - w / 2
  return `M${x0},${yBase}V${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}H${x0 + w - r}Q${x0 + w},${yTop} ${x0 + w},${yTop + r}V${yBase}Z`
}

const lastPoint = (x, values) => {
  for (let i = x.length - 1; i >= 0; i--) if (values?.[i] != null) return [x[i], values[i]]
  return null
}

/** Spread label y-positions so none are closer than `gap` px, keeping their order. */
function spread(ys, gap, min, max) {
  const order = ys.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0])
  const out = [...ys]
  let prev = -Infinity
  for (const [y, i] of order) {
    out[i] = Math.max(y, prev + gap)
    prev = out[i]
  }
  const overflow = prev - max
  if (overflow > 0) order.forEach(([, i]) => (out[i] = Math.max(min, out[i] - overflow)))
  return out
}

/**
 * series: [{ key, label, color, values, kind: 'line'|'columns', spanGaps, markers,
 *            band: { p5, p95, p25, p75 }, fmt, endLabel, weight }]
 * gap: { upper: key, lower: key, text } draws a bracket between two series' end values.
 */
export default function Chart({
  x, series, shade = [], shadeLabel, marker, yFormat, yZero = false, height = 200,
  hoverYear, onHover, ariaLabel, endLabels = false, gap,
}) {
  const [ref, width] = useWidth()
  const M = { top: shadeLabel ? 24 : 12, right: endLabels ? LABEL_W : 16, bottom: 26, left: 56 }
  const iw = width - M.left - M.right
  const ih = height - M.top - M.bottom
  const x0 = x[0]
  const x1 = x[x.length - 1]
  const sx = (v) => M.left + ((v - x0) / Math.max(1, x1 - x0)) * iw

  const all = series.flatMap((s) => [
    ...(s.values ?? []),
    ...(s.band ? [...s.band.p5, ...s.band.p95] : []),
  ]).filter((v) => v != null && Number.isFinite(v))
  let lo = all.length ? Math.min(...all) : 0
  let hi = all.length ? Math.max(...all) : 1
  if (yZero) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  const ticks = niceTicks(lo, hi, 4)
  const y0 = ticks[0]
  const y1 = ticks[ticks.length - 1]
  const sy = (v) => M.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih
  const step = iw / Math.max(1, x1 - x0)
  const xTicks = x.filter((v) => v % (x1 - x0 > 30 ? 10 : 5) === 0)

  const idx = hoverYear == null ? -1 : x.indexOf(hoverYear)
  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const year = Math.round(x0 + ((e.clientX - rect.left - M.left) / iw) * (x1 - x0))
    onHover?.(year >= x0 && year <= x1 ? year : null)
  }
  const tipLeft = idx >= 0 ? sx(x[idx]) : 0
  const tipOnLeft = tipLeft > width * 0.55

  // Direct end labels (value + name), spread apart with leader lines when they collide.
  const labelled = endLabels
    ? series.map((s) => ({ s, end: lastPoint(x, s.values) })).filter((d) => d.end && d.s.endLabel != null)
    : []
  const labelYs = spread(labelled.map((d) => sy(d.end[1])), 30, M.top + 8, M.top + ih)
  const ends = Object.fromEntries(labelled.map((d) => [d.s.key, d.end]))

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}
        onMouseMove={handleMove} onMouseLeave={() => onHover?.(null)}>
        {shade.map((r) => {
          const a = sx(Math.max(x0, r.start - 0.5))
          const b = sx(Math.min(x1, r.end + 0.5))
          return (
            <g key={r.start}>
              <rect className="shade" x={a} width={Math.max(0, b - a)} y={M.top} height={ih} rx={4} />
              {shadeLabel && <text className="shade-label" x={(a + b) / 2} y={M.top - 8} textAnchor="middle">{shadeLabel}</text>}
            </g>
          )
        })}
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'baseline' : 'gridline'} x1={M.left} x2={M.left + iw} y1={sy(t)} y2={sy(t)} />
            <text className="tick" x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end">
              {yFormat ? yFormat(t) : t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} className="tick" x={sx(t)} y={height - 8} textAnchor="middle">{t}</text>
        ))}
        {marker != null && marker >= x0 && marker <= x1 && (
          <line className="onset" x1={sx(marker - 0.5)} x2={sx(marker - 0.5)} y1={M.top} y2={M.top + ih} />
        )}

        {series.map((s) => s.band && (
          <g key={`${s.key}-band`} style={{ color: s.color }}>
            <path className="band-outer" d={areaPath(x, s.band.p5, s.band.p95, sx, sy)} />
            <path className="band-inner" d={areaPath(x, s.band.p25, s.band.p75, sx, sy)} />
          </g>
        ))}

        {series.map((s) => {
          if (s.kind === 'columns') {
            const w = Math.min(24, Math.max(2, step - 2))
            return (
              <g key={s.key} style={{ color: s.color }}>
                {x.map((xv, i) => s.values[i] != null && (
                  <path key={xv} className="column" d={columnPath(sx(xv), w, sy(s.values[i]), sy(Math.max(0, y0)))} />
                ))}
              </g>
            )
          }
          return (
            <g key={s.key} style={{ color: s.color }}>
              {runs(x, s.values, s.spanGaps).map((r) => (
                <path key={r[0][0]} className={`line ${s.weight ?? ''}`} d={linePath(r, sx, sy)} />
              ))}
              {s.markers && x.map((xv, i) => s.values[i] != null && (
                <circle key={xv} className="dot" cx={sx(xv)} cy={sy(s.values[i])} r={3.5} />
              ))}
            </g>
          )
        })}

        {labelled.map(({ s, end }, i) => {
          const [ex, ey] = [sx(end[0]), sy(end[1])]
          const ly = labelYs[i]
          return (
            <g key={`${s.key}-label`}>
              <circle className="end-dot" style={{ color: s.color }} cx={ex} cy={ey} r={4.5} />
              {Math.abs(ly - ey) > 2 && <path className="leader" d={`M${ex + 6},${ey}L${ex + 14},${ly}`} />}
              <text className="end-value" x={ex + 18} y={ly - 2}>{(s.fmt ?? yFormat)(end[1])}</text>
              <text className="end-name" x={ex + 18} y={ly + 12}>{s.endLabel}</text>
            </g>
          )
        })}

        {gap && ends[gap.upper] && ends[gap.lower] && (() => {
          // Bracket just left of the line ends, pill to its left: clear of the end labels.
          const gx = sx(ends[gap.upper][0]) - 12
          const ya = sy(ends[gap.upper][1])
          const yb = sy(ends[gap.lower][1])
          if (Math.abs(yb - ya) < 18) return null
          const mid = (ya + yb) / 2
          return (
            <g className="gap">
              <path d={`M${gx + 5},${ya}H${gx}V${yb}H${gx + 5}`} />
              <rect x={gx - 62} y={mid - 11} width={56} height={22} rx={11} />
              <text x={gx - 34} y={mid} dy="0.35em" textAnchor="middle">{gap.text}</text>
            </g>
          )
        })()}

        {idx >= 0 && (
          <g>
            <line className="crosshair" x1={sx(x[idx])} x2={sx(x[idx])} y1={M.top} y2={M.top + ih} />
            {series.map((s) => s.kind !== 'columns' && s.values?.[idx] != null && (
              <circle key={s.key} className="hover-dot" style={{ color: s.color }} cx={sx(x[idx])} cy={sy(s.values[idx])} r={4.5} />
            ))}
          </g>
        )}
      </svg>

      {idx >= 0 && series.some((s) => s.values?.[idx] != null) && (
        <div className="tooltip" style={tipOnLeft ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }}>
          <div className="tooltip-title">{x[idx]}</div>
          {series.map((s) => s.values?.[idx] != null && (
            <div key={s.key} className="tooltip-row">
              <span className="key" style={{ background: s.color }} />
              <span className="tooltip-label">{s.label}</span>
              <span className="tooltip-value">{(s.fmt ?? yFormat ?? String)(s.values[idx])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label} className="legend-item">
          <span className={`key ${it.kind ?? 'line'}`} style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
