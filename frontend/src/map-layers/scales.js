// Color scales for the map layers. Bins are fixed per metric (not data-driven), so a
// country's color means the same thing every time the data refreshes.
import isoJoin from './isoJoin.json'

const SEQ = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)', 'var(--seq-6)']
const DIV = ['var(--div-1)', 'var(--div-2)', 'var(--div-3)', 'var(--div-4)', 'var(--div-5)']
export const NO_DATA = 'var(--land)'

const pct = (v) => `${v}%`
const people = (v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}k` : `${v}`)

// thresholds: value <= t[i] falls in class i (sequential uses |value| for losses)
const SCALES = {
  intensity_12m: { kind: 'log', t: [0.1, 0.5, 2, 10, 50], fmt: (v) => `${v}` },
  extra_poor_h5: { kind: 'log', t: [1e3, 1e4, 1e5, 5e5, 2e6], fmt: people },
  cost_continue_h5: { kind: 'sequential', abs: true, t: [0.5, 2, 5, 10, 20], fmt: pct },
  peace_dividend_h5: { kind: 'sequential', t: [0.5, 2, 5, 10, 20], fmt: (v) => `${v} pts` },
  neighbor_exposure: { kind: 'sequential', abs: true, t: [0.1, 0.25, 0.5, 1, 2], fmt: pct },
  escalation_3m: {
    kind: 'diverging', t: [-0.5, -0.15, 0.15, 0.5],
    words: ['calming fast', 'calming', 'stable', 'escalating', 'escalating fast'],
    arrows: ['↓↓', '↓', '→', '↑', '↑↑'],
  },
  unrest_z: {
    kind: 'diverging', t: [-1.5, -0.5, 0.5, 1.5],
    words: ['much quieter', 'quieter', 'usual', 'more unrest', 'much more unrest'],
    arrows: ['↓↓', '↓', '→', '↑', '↑↑'],
  },
}

export function scaleFor(metric) {
  return SCALES[metric] ?? SCALES.intensity_12m
}

export function classIndex(metric, value) {
  const s = scaleFor(metric)
  const v = s.abs ? Math.abs(value) : value
  const i = s.t.findIndex((t) => v <= t)
  return i === -1 ? s.t.length : i
}

export function colorFor(metric, value) {
  if (value == null || Number.isNaN(value)) return NO_DATA
  const s = scaleFor(metric)
  if (s.kind === 'diverging') return DIV[classIndex(metric, value)]
  if (s.kind === 'log' && value <= 0) return SEQ[0]
  return SEQ[classIndex(metric, value)]
}

/** Legend rows: [{color, label, word?, arrow?}] from low to high. */
export function legendRows(metric) {
  const s = scaleFor(metric)
  const colors = s.kind === 'diverging' ? DIV : SEQ
  return colors.map((color, i) => {
    const lo = i === 0 ? null : s.t[i - 1]
    const hi = i < s.t.length ? s.t[i] : null
    const label = lo == null ? `up to ${s.fmt?.(hi) ?? hi}` : hi == null ? `over ${s.fmt?.(lo) ?? lo}` : `${s.fmt?.(lo) ?? lo} to ${s.fmt?.(hi) ?? hi}`
    return { color, label, word: s.words?.[i], arrow: s.arrows?.[i] }
  })
}

export function describe(metric, value) {
  const s = scaleFor(metric)
  if (s.kind !== 'diverging' || value == null) return null
  const i = classIndex(metric, value)
  return { word: s.words[i], arrow: s.arrows[i] }
}

/** Natural Earth join: ISO_A3_EH (never ISO_A3, which is -99 for France and Norway);
 * where ISO_A3_EH is -99 too (Kosovo, Somaliland, N. Cyprus), use the ADM0_A3 override. */
export function joinCode(props) {
  if (props.ISO_A3_EH && props.ISO_A3_EH !== '-99') return props.ISO_A3_EH
  return isoJoin.overrides[props.ADM0_A3] ?? null
}
