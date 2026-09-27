import { bandFrom, compact, linear, niceTicks, pathFrom, signedPct, useWidth } from './base.js'
import './charts.css'

const SEQ = ['#FFEDA0', '#FED976', '#FEB24C', '#FD8D3C', '#FC4E2A', '#B10026']

function Axis({ ticks, sy, x0, x1, fmt }) {
  return ticks.map((t) => (
    <g key={t}>
      <line className={t === 0 ? 'ch-zero' : 'ch-grid'} x1={x0} x2={x1} y1={sy(t)} y2={sy(t)} />
      <text className="ch-tick" x={x0 - 8} y={sy(t)} dy="0.32em" textAnchor="end">{fmt(t)}</text>
    </g>
  ))
}

/** Monthly worldwide fatalities; bars shaded by magnitude on the sequential ramp. */
export function MonthlyBars({ data, summary }) {
  const [ref, w] = useWidth()
  const h = 240
  const m = { t: 22, r: 8, b: 26, l: 56 }
  const vals = data.map((d) => d.fatalities)
  const max = Math.max(...vals, 1)
  const ticks = niceTicks(0, max, 4)
  const sy = linear(0, ticks[ticks.length - 1], h - m.b, m.t)
  const bw = (w - m.l - m.r) / data.length
  const peak = vals.indexOf(max)
  return (
    <div ref={ref} className="chart">
      <svg width={w} height={h} role="img" aria-label={summary}>
        <Axis ticks={ticks} sy={sy} x0={m.l} x1={w - m.r} fmt={(v) => compact.format(v)} />
        {data.map((d, i) => {
          const x = m.l + i * bw + 1
          const y = sy(d.fatalities)
          const barH = Math.max(0, h - m.b - y)
          const cls = Math.min(5, Math.floor((d.fatalities / max) * 6))
          const r = Math.min(4, (bw - 2) / 2, barH)
          return (
            <path key={d.month} style={{ fill: SEQ[cls] }}
              d={`M${x},${h - m.b}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - 2 - r}Q${x + bw - 2},${y} ${x + bw - 2},${y + r}V${h - m.b}Z`}>
              <title>{`${d.month}: ${Math.round(d.fatalities).toLocaleString()} deaths`}</title>
            </path>
          )
        })}
        {data.map((d, i) => (i % 6 === 0 || i === data.length - 1) && (
          <text key={d.month} className="ch-tick" x={m.l + i * bw + bw / 2} y={h - 8} textAnchor="middle">{d.month}</text>
        ))}
        <text className="ch-label" x={Math.min(w - m.r - 4, m.l + peak * bw + bw / 2)} y={sy(max) - 6}
          textAnchor={peak > data.length * 0.8 ? 'end' : 'middle'}>
          peak {compact.format(max)} ({data[peak].month})
        </text>
      </svg>
    </div>
  )
}

/** Effect path with 90% band; pre-war years shaded as the honesty check. */
export function EffectPath({ horizons, mid, lo, hi, prewar, summary }) {
  const [ref, w] = useWidth()
  const h = 316
  const m = { t: 26, r: 96, b: 46, l: 56 }
  const all = [...lo, ...hi, 0]
  const ticks = niceTicks(Math.min(...all), Math.max(...all), 5)
  const sx = linear(horizons[0], horizons[horizons.length - 1], m.l, w - m.r)
  const sy = linear(ticks[0], ticks[ticks.length - 1], h - m.b, m.t)
  const a = sx(prewar[0] - 0.4)
  const b = sx(prewar[1] + 0.5)
  const last = horizons.length - 1
  return (
    <div ref={ref} className="chart">
      <svg width={w} height={h} role="img" aria-label={summary}>
        <rect className="ch-prewar" x={a} y={m.t} width={b - a} height={h - m.t - m.b} />
        <text className="ch-zone" x={(a + b) / 2} y={m.t - 8} textAnchor="middle">before the war</text>
        <text className="ch-zone" x={b + 6} y={m.t - 8}>war starts</text>
        <line className="ch-onset" x1={b} x2={b} y1={m.t} y2={h - m.b} />
        <Axis ticks={ticks} sy={sy} x0={m.l} x1={w - m.r} fmt={signedPct} />
        <path className="ch-band" d={bandFrom(horizons, lo, hi, sx, sy)} />
        <path className="ch-line" d={pathFrom(horizons, mid, sx, sy)} />
        {horizons.map((x, i) => (
          <circle key={x} className="ch-hit" cx={sx(x)} cy={sy(mid[i])} r="7">
            <title>{`${x > 0 ? `${x} years after` : x === 0 ? 'Year the war starts' : `${-x} years before`}: ${signedPct(mid[i])} (range ${signedPct(lo[i])} to ${signedPct(hi[i])})`}</title>
          </circle>
        ))}
        {horizons.filter((x) => x % 2 === 0 || x === horizons[0]).map((x) => (
          <text key={x} className="ch-tick" x={sx(x)} y={h - m.b + 16} textAnchor="middle">{x === 0 ? '0' : x > 0 ? `+${x}` : x}</text>
        ))}
        <text className="ch-label" x={sx(horizons[last]) + 8} y={sy(mid[last])} dy="0.32em">typical {signedPct(mid[last])}</text>
        <text className="ch-label muted" x={sx(horizons[last]) + 8} y={sy(lo[last])} dy="0.32em">{signedPct(lo[last])}</text>
        <text className="ch-label muted" x={sx(horizons[last]) + 8} y={sy(hi[last])} dy="0.32em">{signedPct(hi[last])}</text>
        <text className="ch-tick" x={(m.l + w - m.r) / 2} y={h - 4} textAnchor="middle">years relative to the start of the war</text>
      </svg>
    </div>
  )
}

/** Cumulative effect after 10 years by war length, with 90% range whiskers. */
export function DurationBars({ items, summary }) {
  const [ref, w] = useWidth()
  const h = 260
  const m = { t: 18, r: 16, b: 34, l: 56 }
  const all = items.flatMap((d) => [d.lo, d.hi, 0])
  const ticks = niceTicks(Math.min(...all), Math.max(...all), 4)
  const sy = linear(ticks[0], ticks[ticks.length - 1], h - m.b, m.t)
  const slot = (w - m.l - m.r) / items.length
  const bw = Math.min(56, slot * 0.5)
  return (
    <div ref={ref} className="chart">
      <svg width={w} height={h} role="img" aria-label={summary}>
        <Axis ticks={ticks} sy={sy} x0={m.l} x1={w - m.r} fmt={signedPct} />
        {items.map((d, i) => {
          const cx = m.l + slot * i + slot / 2
          const y0 = sy(0)
          const y1 = sy(d.mid)
          return (
            <g key={d.duration}>
              <rect className="ch-bar" x={cx - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.abs(y1 - y0)} rx="3">
                <title>{`${d.duration}-year war: ${signedPct(d.mid)} (range ${signedPct(d.lo)} to ${signedPct(d.hi)})`}</title>
              </rect>
              <line className="ch-whisker" x1={cx} x2={cx} y1={sy(d.lo)} y2={sy(d.hi)} />
              <line className="ch-whisker" x1={cx - 6} x2={cx + 6} y1={sy(d.lo)} y2={sy(d.lo)} />
              <line className="ch-whisker" x1={cx - 6} x2={cx + 6} y1={sy(d.hi)} y2={sy(d.hi)} />
              <text className="ch-label" x={cx + bw / 2 + 4} y={y1} dy="0.32em">{signedPct(d.mid)}</text>
              <text className="ch-tick strong" x={cx} y={h - 12} textAnchor="middle">{d.duration} {d.duration === 1 ? 'year' : 'years'}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** One held-out war: what happened vs predicted with and without war. */
export function MiniWar({ war }) {
  const [ref, w] = useWidth(160, 120)
  const h = 170
  const m = { t: 8, r: 8, b: 20, l: 44 }
  const xs = war.years
  const vals = [...war.actual, ...war.war_lo, ...war.war_hi, ...war.nowar].filter((v) => v != null)
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 3)
  const sx = linear(xs[0], xs[xs.length - 1], m.l, w - m.r)
  const sy = linear(ticks[0], ticks[ticks.length - 1], h - m.b, m.t)
  const fmt = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`)
  const summary = `${war.name} ${war.start}: reality was ${Math.abs(war.off_pct).toFixed(0)}% ${war.off_pct > 0 ? 'better' : 'worse'} than predicted; ${war.inside ? 'inside' : 'outside'} the 90% range.`
  return (
    <div ref={ref} className="chart mini">
      <svg width={w} height={h} role="img" aria-label={summary}>
        <Axis ticks={ticks} sy={sy} x0={m.l} x1={w - m.r} fmt={fmt} />
        <path className="ch-band" d={bandFrom(xs, war.war_lo, war.war_hi, sx, sy)} />
        <path className="ch-line nowar" d={pathFrom(xs, war.nowar, sx, sy)} />
        <path className="ch-line" d={pathFrom(xs, war.war_mid, sx, sy)} />
        <path className="ch-line actual" d={pathFrom(xs, war.actual, sx, sy)} />
        <text className="ch-tick" x={m.l} y={h - 4}>{xs[0]}</text>
        <text className="ch-tick" x={w - m.r} y={h - 4} textAnchor="end">{xs[xs.length - 1]}</text>
      </svg>
    </div>
  )
}

/** Share of country-years with no GDP / no poverty data, by conflict tier. */
export function TierBars({ tiers, summary }) {
  const [ref, w] = useWidth()
  const row = 30
  const h = tiers.length * row * 2 + 16
  const m = { l: 150, r: 56 }
  const sx = linear(0, 100, m.l, w - m.r)
  return (
    <div ref={ref} className="chart">
      <svg width={w} height={h} role="img" aria-label={summary}>
        {tiers.map((t, i) => {
          const y = 8 + i * row * 2
          return (
            <g key={t.tier}>
              <text className="ch-tick strong" x={m.l - 10} y={y + row - 4} textAnchor="end">{t.tier}</text>
              {[['GDP', t.gdp_missing, 'ch-bar'], ['poverty survey', t.poverty_missing, 'ch-bar alt']].map(([label, v, cls], j) => (
                <g key={label}>
                  <rect className={cls} x={m.l} y={y + j * (row - 4)} width={Math.max(1, sx(v) - m.l)} height={row - 10} rx="3">
                    <title>{`${t.tier}: ${label} missing for ${v.toFixed(0)}% of country-years`}</title>
                  </rect>
                  <text className="ch-label" x={sx(v) + 6} y={y + j * (row - 4) + (row - 10) / 2} dy="0.32em">
                    {v.toFixed(0)}% no {label}
                  </text>
                </g>
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
