const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const fmt = {
  usd: (v) => (v == null ? '–' : `$${Math.abs(v) >= 10000 ? compact.format(v) : whole.format(v)}`),
  pct: (v) => (v == null ? '–' : `${v.toFixed(1)}%`),
  signedPct: (v) => (v == null ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`),
  pp: (v) => (v == null ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(1)} pp`),
  people: (v) => (v == null ? '–' : `${v > 0 ? '+' : ''}${compact.format(v)}`),
  num: (v) => (v == null ? '–' : Math.abs(v) >= 1000 ? compact.format(v) : v.toFixed(1)),
}

/** Round tick values ("nice numbers") covering [min, max]. */
export function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1
    min -= pad
    max += pad
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const start = Math.floor(min / step) * step
  const ticks = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toPrecision(12)))
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

/** Group conflict flags into episodes, merging lulls of up to `gap` years. */
export function conflictEpisodes(history, gap = 1) {
  const out = []
  const { years, conflict, deaths_per_100k: dp } = history
  let cur = null
  years.forEach((y, i) => {
    if (conflict[i]) {
      if (cur && y - cur.end <= gap + 1) {
        cur.end = y
      } else {
        cur = { start: y, end: y }
        out.push(cur)
      }
    }
  })
  return out.map((e) => {
    const vals = years
      .map((y, i) => (y >= e.start && y <= e.end ? dp[i] ?? 0 : null))
      .filter((v) => v != null)
    return {
      ...e,
      duration: e.end - e.start + 1,
      intensity: vals.reduce((a, b) => a + b, 0) / vals.length,
    }
  })
}
