// Number formatting shared by the map tooltip, legend and country panel.
const MINUS = '−'
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 2 })

const signed = (v, digits = 0) => {
  const s = Math.abs(v).toFixed(digits)
  if (Number(s) === 0) return `0`
  return `${v < 0 ? MINUS : '+'}${s}`
}

const FORMATS = {
  intensity_12m: (v) => (v < 0.1 && v > 0 ? '<0.1' : v >= 10 ? v.toFixed(0) : v.toFixed(1)),
  escalation_3m: (v) => signed(v, 2),
  unrest_z: (v) => signed(v, 1),
  cost_continue_h5: (v) => `${signed(v, Math.abs(v) < 1 ? 1 : 0)}%`,
  peace_dividend_h5: (v) => `${signed(v, Math.abs(v) < 1 ? 1 : 0)} pts`,
  neighbor_exposure: (v) => `${signed(v, Math.abs(v) < 1 ? 2 : 1)}%`,
  extra_poor_h5: (v) => (Math.abs(v) < 0.5 ? '0' : `${v < 0 ? MINUS : '+'}${compact.format(Math.abs(v))}`),
}

export function fmtValue(metric, v) {
  if (v == null || Number.isNaN(v)) return '–'
  return (FORMATS[metric] ?? ((x) => x.toFixed(1)))(v)
}

/** "−24% to −5%" or null when the metric has no uncertainty band. */
export function fmtRange(metric, row) {
  if (!row || row.lo == null || row.hi == null || row.lo === row.hi) return null
  return `${fmtValue(metric, row.lo)} to ${fmtValue(metric, row.hi)}`
}

export function fmtPeople(v) {
  return v == null ? '–' : compact.format(v)
}
