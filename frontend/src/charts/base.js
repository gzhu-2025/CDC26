import { useLayoutEffect, useRef, useState } from 'react'

/** Measured container width (before first paint, then on resize). */
export function useWidth(initial = 640, min = 200) {
  const ref = useRef(null)
  const [w, setW] = useState(initial)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(Math.max(min, Math.floor(el.getBoundingClientRect().width)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [min])
  return [ref, w]
}

export function niceTicks(lo, hi, count = 4) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1]
  if (lo === hi) { lo -= 1; hi += 1 }
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const out = []
  for (let v = Math.floor(lo / step) * step; v <= hi + step / 2; v += step) out.push(Number(v.toPrecision(12)))
  if (out[out.length - 1] < hi) out.push(out[out.length - 1] + step)
  return out
}

export const MINUS = '−'
export const signedPct = (v) => `${v < 0 ? MINUS : v > 0 ? '+' : ''}${Math.abs(v).toFixed(0)}%`
export const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
// people: 2 significant figures (18.5M -> 18M, 955K -> 950K)
export const people2 = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 2 })

export function linear(d0, d1, r0, r1) {
  return (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0)
}

export function pathFrom(xs, ys, sx, sy) {
  let d = ''
  let pen = false
  xs.forEach((x, i) => {
    const y = ys[i]
    if (y == null || Number.isNaN(y)) { pen = false; return }
    d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`
    pen = true
  })
  return d
}

export function bandFrom(xs, lo, hi, sx, sy) {
  const pts = xs.map((x, i) => [x, lo[i], hi[i]]).filter(([, a, b]) => a != null && b != null)
  if (!pts.length) return ''
  const top = pts.map(([x, , b], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(b).toFixed(1)}`).join('')
  const bot = [...pts].reverse().map(([x, a]) => `L${sx(x).toFixed(1)},${sy(a).toFixed(1)}`).join('')
  return `${top}${bot}Z`
}
