import { useState, useEffect } from 'react';

// Country panel: recorded data first, model estimates after. Values come from map_metrics.json.
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 2 });
const MINUS = '−';

const STATUS = {
  war: 'War',
  armed_conflict: 'Armed conflict',
  low_level: 'Low-level violence',
  calm: 'Calm',
  unknown: 'No conflict data',
};

// same bands as the map legend
const ESCALATION = { t: [-0.5, -0.15, 0.15, 0.5], words: ['Calming fast', 'Calming', 'Stable', 'Escalating', 'Escalating fast'] };
const UNREST = { t: [-1.5, -0.5, 0.5, 1.5], words: ['Much quieter than usual', 'Quieter than usual', 'About the usual level', 'More unrest than usual', 'Much more unrest than usual'] };
// UCDP levels on UCDP-equivalent battle deaths per year: 25+ armed conflict, 1,000+ war
const WAR_DEATHS = 1000;
const STATUS_HELP = {
  war: '1,000 or more battle deaths in the past 12 months (UCDP war level)',
  armed_conflict: '25 to 999 battle deaths in the past 12 months (UCDP armed-conflict level); can include fighting between criminal groups and the state',
  low_level: 'Some political-violence deaths, but under 25 battle deaths in the past 12 months',
  calm: 'No recorded political-violence deaths in the past 12 months',
};
const statusOf = (info, m) => {
  if (info.status !== 'at_war') return info.status;
  const inp = m.cost_continue_h5?.inputs || m.peace_dividend_h5?.inputs;
  const battle = inp ? inp.acled_battle_fatalities_12m * inp.ucdp_equivalent_factor : null;
  return battle != null && battle >= WAR_DEATHS ? 'war' : 'armed_conflict';
};

const band = (scale, v) => {
  const i = scale.t.findIndex((t) => v <= t);
  return scale.words[i === -1 ? scale.t.length : i];
};

const has = (row) => row && row.value != null && !Number.isNaN(row.value);
// fewer deaths than this across the last 6 months is too few to call a trend (0 -> 1 is "+100%")
const MIN_TREND_DEATHS = 25;
const tooFewForTrend = (row) =>
  (row?.inputs?.fatalities_last_3m ?? 0) + (row?.inputs?.fatalities_prev_3m ?? 0) < MIN_TREND_DEATHS;
const pct = (v) => `${Math.abs(v) < 1 ? Math.abs(v).toFixed(1) : Math.round(Math.abs(v))}%`;
const signedPct = (v) => `${v < 0 ? MINUS : '+'}${pct(v)}`;
const people = (v) => compact.format(Math.max(0, v));

function Sparkline({ points, width = 360, height = 80 }) {
  const vals = points.map((p) => p.fatalities);
  const known = vals.filter((v) => v != null);
  if (!known.length) return <div className="cp-muted">No monthly records.</div>;
  const max = Math.max(...known, 1);
  const step = width / Math.max(1, points.length - 1);
  const y = (v) => height - 14 - (v / max) * (height - 24);
  const segs = [];
  let cur = [];
  vals.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push(`${(i * step).toFixed(1)},${y(v).toFixed(1)}`);
  });
  if (cur.length) segs.push(cur);
  const lastIdx = vals.length - 1;
  return (
    <figure className="cp-spark">
      <svg viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`Monthly political-violence deaths from ${points[0]?.month} to ${points[lastIdx]?.month}, peak ${Math.round(max)}`}>
        <line x1="0" x2={width} y1={height - 14} y2={height - 14} className="cp-spark-base" />
        {segs.map((s, i) => <polyline key={i} points={s.join(' ')} className="cp-spark-line" />)}
        {vals[lastIdx] != null && <circle cx={lastIdx * step} cy={y(vals[lastIdx])} r="3" className="cp-spark-dot" />}
        {points.map((p, i) => p.fatalities != null && (
          <rect key={p.month} x={i * step - step / 2} y="0" width={step} height={height - 14} fill="transparent">
            <title>{`${p.month}: ${Math.round(p.fatalities).toLocaleString()} deaths`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="cp-spark-axis">
        <span>{points[0]?.month}</span>
        <span>peak {Math.round(max).toLocaleString()} / month</span>
        <span>{points[lastIdx]?.month}</span>
      </figcaption>
    </figure>
  );
}

const full = (v) => Math.round(v).toLocaleString('en-US');
const per100k = (v) => (v >= 10 ? Math.round(v) : Number(v.toPrecision(2))).toLocaleString('en-US');
const listNames = (names) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
const range = (row, fmt) =>
  row.lo != null && row.hi != null && row.lo !== row.hi ? ` (likely range ${fmt(row.lo)} to ${fmt(row.hi)})` : '';

function escalationSentence(esc) {
  if (!has(esc)) return 'There is no data on how deaths have changed recently.';
  if (tooFewForTrend(esc)) return `There have been too few deaths in the last 6 months (under ${MIN_TREND_DEATHS}) to show a trend.`;
  const change = Math.round((Math.exp(esc.value) - 1) * 100);
  const vs = 'in the last 3 months compared with the 3 before';
  switch (band(ESCALATION, esc.value)) {
    case 'Escalating fast': return <>Deaths have risen sharply, by <b>{change}%</b>, {vs}.</>;
    case 'Escalating': return <>Deaths have risen by <b>{change}%</b> {vs}.</>;
    case 'Calming': return <>Deaths have fallen by <b>{Math.abs(change)}%</b> {vs}.</>;
    case 'Calming fast': return <>Deaths have fallen sharply, by <b>{Math.abs(change)}%</b>, {vs}.</>;
    default: return <>Deaths have held <b>roughly steady</b> {vs} ({change >= 0 ? 'up' : 'down'} about {Math.abs(change)}%).</>;
  }
}

const UNREST_SENTENCE = [
  'much less common than usual',
  'less common than usual',
  'at about their usual level',
  'more common than usual',
  'much more common than usual',
];
function unrestSentence(unrest) {
  if (!has(unrest)) return 'There is no data on protests and riots.';
  const i = UNREST.t.findIndex((t) => unrest.value <= t);
  return <>Protests and riots have been <b>{UNREST_SENTENCE[i === -1 ? UNREST.t.length : i]}</b> over the past 3 months, compared with the past 3 years.</>;
}

function Estimate({ title, row, children }) {
  return (
    <p className="cp-text">
      <span className="cp-lead">{title}. </span>
      {has(row) ? children : `Not available: ${row?.note || 'no data'}.`}
    </p>
  );
}

export default function Chart({ country, iso3, onClose }) {
  const [info, setInfo] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState({});

  useEffect(() => {
    fetch('/map_metrics.json')
      .then(res => res.json())
      .then(data => {
        // look up by country code when we have it (names differ between sources)
        let code = iso3 && data.countries[iso3] ? iso3 : null;
        if (!code) {
          code = Object.keys(data.countries).find(c => data.countries[c].name === country) || null;
        }
        const rows = {};
        if (code) {
          for (const [key, byCountry] of Object.entries(data.metrics)) {
            if (byCountry[code]) rows[key] = byCountry[code];
          }
        }
        setNames(Object.fromEntries(Object.entries(data.countries).map(([c, v]) => [c, v.name])));
        setInfo(code ? data.countries[code] : null);
        setMetrics(rows);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [country, iso3]);

  const m = metrics || {};
  const asOf = Object.values(m).find(r => r?.as_of)?.as_of;
  const deaths = m.intensity_12m;
  const esc = m.escalation_3m;
  const unrest = m.unrest_z;
  const status = info ? statusOf(info, m) : 'unknown';
  const cost = m.cost_continue_h5;
  const gain = m.peace_dividend_h5;
  const poor = m.extra_poor_h5;
  const nb = m.neighbor_exposure;
  const nbFrom = (nb?.inputs?.main_sources || []).map((c) => names[c] || c);

  return (
    <div className="country-panel">
      <div className="cp-head">
        <h2>{country}</h2>
        <button className="cp-close" onClick={onClose} aria-label="Close country panel">&times;</button>
      </div>

      {loading && <p className="cp-muted">Loading data…</p>}
      {!loading && !info && <p className="cp-muted">No data available for {country}.</p>}

      {!loading && info && (
        <>
          <div className="cp-status">
            <span className={`cp-badge ${status}`} title={STATUS_HELP[status]}>{STATUS[status] || STATUS.unknown}</span>
            {asOf && <span className="cp-muted">data as of {asOf}</span>}
          </div>

          <section>
            <h3>Now <span className="cp-kind">recorded data</span></h3>
            <p className="cp-text">
              {has(deaths)
                ? <><b>{full(deaths.inputs?.pv_fatalities_12m ?? 0)}</b> people have been killed in political violence in {country} over the past 12 months, or {per100k(deaths.value)} per 100,000 people.</>
                : `There is no record of political-violence deaths in ${country}.`}
            </p>
            <p className="cp-text">{escalationSentence(esc)}</p>
            <p className="cp-text">{unrestSentence(unrest)}</p>
            <div className="cp-stat">
              <div className="cp-label">Deaths per month, past 36 months</div>
              {info.fatalities_36m?.length ? <Sparkline points={info.fatalities_36m} /> : <div className="cp-muted">No trend data.</div>}
            </div>
          </section>

          <section>
            <h3>If fighting continues <span className="cp-kind">model estimates</span></h3>
            <p className="cp-note">Five years ahead. These are rough: the likely ranges are wide and often include no change.</p>
            <Estimate title="Cost to the economy" row={cost}>
              {has(cost) && (Math.abs(cost.value) < 0.05
                ? <>The model finds <b>no measurable cost</b> to GDP per person, because there is little or no fighting.</>
                : <>If today&rsquo;s fighting lasts 5 more years, GDP per person could be about <b>{pct(cost.value)} {cost.value <= 0 ? 'lower' : 'higher'}</b> than with no war{range(cost, signedPct)}.</>)}
            </Estimate>
            <Estimate title="Gain from stopping now" row={gain}>
              {has(gain) && <>Ending the fighting this year instead of in 4 years could save about <b>{gain.value.toFixed(1)} percentage points</b> of GDP per person{range(gain, (v) => v.toFixed(1))}.</>}
            </Estimate>
            <Estimate title="Poverty" row={poor}>
              {has(poor) && <>About <b>{people(poor.value)}</b> more people could fall below $2.15 a day if today&rsquo;s fighting lasts 5 more years{range(poor, people)}.</>}
            </Estimate>
            <Estimate title="Nearby fighting" row={nb}>
              {has(nb) && (Math.abs(nb.value) < 0.05
                ? <>Fighting in neighbouring countries has <b>no measurable effect</b> on GDP per person here.</>
                : <>Fighting in neighbouring countries{nbFrom.length ? `, mainly ${listNames(nbFrom)},` : ''} could leave GDP per person about <b>{pct(nb.value)} {nb.value <= 0 ? 'lower' : 'higher'}</b> if it continues{range(nb, signedPct)}.</>)}
            </Estimate>
          </section>

          <p className="cp-foot">Sources: ACLED, World Bank, UCDP. Estimates are associational, not proof of cause.</p>
        </>
      )}
    </div>
  );
}
