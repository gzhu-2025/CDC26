/** 36-month fatalities sparkline. Months before ACLED coverage are gaps, not zeros. */
export default function Sparkline({ points, width = 360, height = 56 }) {
  const vals = points.map((p) => p.fatalities)
  const known = vals.filter((v) => v != null)
  if (!known.length) return <div className="cp-muted">No monthly records.</div>
  const max = Math.max(...known, 1)
  const step = width / Math.max(1, points.length - 1)
  const y = (v) => height - 4 - (v / max) * (height - 10)
  const segs = []
  let cur = []
  vals.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segs.push(cur)
      cur = []
    } else cur.push(`${(i * step).toFixed(1)},${y(v).toFixed(1)}`)
  })
  if (cur.length) segs.push(cur)
  const lastIdx = vals.length - 1
  const peakIdx = vals.indexOf(Math.max(...known))
  const first = points[0]?.month
  const last = points[lastIdx]?.month
  return (
    <figure className="cp-spark">
      <svg viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`Monthly political-violence deaths, ${first} to ${last}; peak ${Math.round(max)} in ${points[peakIdx]?.month}`}>
        <line x1="0" x2={width} y1={height - 4} y2={height - 4} className="cp-spark-base" />
        {segs.map((s, i) => <polyline key={i} points={s.join(' ')} className="cp-spark-line" />)}
        {vals[lastIdx] != null && <circle cx={lastIdx * step} cy={y(vals[lastIdx])} r="3" className="cp-spark-dot" />}
        {points.map((p, i) => p.fatalities != null && (
          <rect key={p.month} x={i * step - step / 2} y="0" width={step} height={height} fill="transparent">
            <title>{`${p.month}: ${Math.round(p.fatalities).toLocaleString()} deaths`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="cp-spark-axis">
        <span>{first}</span>
        <span>peak {Math.round(max).toLocaleString()} / month</span>
        <span>{last}</span>
      </figcaption>
    </figure>
  )
}
