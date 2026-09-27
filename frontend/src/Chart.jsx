import React, { useState, useEffect } from 'react';

function Sparkline({ points, width = 360, height = 80 }) {
  const vals = points.map((p) => p.fatalities)
  const known = vals.filter((v) => v != null)
  if (!known.length) return <div style={{ color: '#888' }}>No monthly records.</div>
  const max = Math.max(...known, 1)
  const step = width / Math.max(1, points.length - 1)
  const y = (v) => height - 14 - (v / max) * (height - 24)
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
    <figure style={{ margin: 0, padding: 0 }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <line x1="0" x2={width} y1={height - 14} y2={height - 14} stroke="#ccc" strokeWidth="1" />
        {segs.map((s, i) => (
          <polyline key={i} points={s.join(' ')} fill="none" stroke="#AD4930" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {vals[lastIdx] != null && <circle cx={lastIdx * step} cy={y(vals[lastIdx])} r="3" fill="#AD4930" />}
        {points.map((p, i) => p.fatalities != null && (
          <rect key={p.month} x={i * step - step / 2} y="0" width={step} height={height - 14} fill="transparent">
            <title>{`${p.month}: ${Math.round(p.fatalities).toLocaleString()} deaths`}</title>
          </rect>
        ))}
      </svg>
      <figcaption style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
        <span>{first}</span>
        <span>peak {Math.round(max).toLocaleString()} / month</span>
        <span>{last}</span>
      </figcaption>
    </figure>
  )
}

export default function Chart({ country, onClose }) {
  const [countryData, setCountryData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/map_metrics.json')
      .then(res => res.json())
      .then(data => {
        let foundIso3 = null;
        let cData = null;
        for (const [iso3, info] of Object.entries(data.countries)) {
          if (info.name === country) {
            foundIso3 = iso3;
            cData = info;
            break;
          }
        }
        
        // Also check if geoToAppName matched
        if (!foundIso3) {
            // Need the mapping, but we don't have it here. 
            // Just basic fallback:
            for (const [iso3, info] of Object.entries(data.countries)) {
              if (info.name.includes(country) || country.includes(info.name)) {
                foundIso3 = iso3;
                cData = info;
                break;
              }
            }
        }

        if (foundIso3) {
            const cMetrics = {};
            for (const [mKey, mData] of Object.entries(data.metrics)) {
                if (mData[foundIso3]) {
                    cMetrics[mKey] = mData[foundIso3];
                }
            }
            setCountryData(cData);
            setMetrics(cMetrics);
        }
        setCatalog(data.catalog);
        setLoading(false);
      })
      .catch(err => {
          console.error(err);
          setLoading(false);
      });
  }, [country]);

  return (
    <div className="chart-container" style={{ padding: '0 10px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>{country}</h2>
        <button 
          onClick={onClose} 
          style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '24px', lineHeight: 1, padding: '0 8px', color: '#666' }}
        >
          &times;
        </button>
      </div>

      {loading && <p>Loading data...</p>}
      
      {!loading && !countryData && <p>No data available for {country}.</p>}

      {!loading && countryData && (
        <div>
          {countryData.headline && (
            <p style={{ fontSize: '1.1rem', fontWeight: 500, color: '#444', marginBottom: '24px' }}>
              {countryData.headline}
            </p>
          )}

          <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '16px' }}>Now</h3>
          
          <div style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, color: '#333' }}>Deadly violence</div>
              <div style={{ fontSize: '1.2rem', color: '#007bff' }}>
                {metrics.intensity_12m ? Number(metrics.intensity_12m.value).toPrecision(3) : 'No data'}
                {metrics.intensity_12m && <span style={{ fontSize: '0.9rem', color: '#666', marginLeft: '6px' }}>deaths per 100k, last 12 months</span>}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, color: '#333' }}>Political-violence deaths per month, last 36 months</div>
              <div style={{ marginTop: '8px' }}>
                {countryData.fatalities_36m ? (
                  <Sparkline points={countryData.fatalities_36m} />
                ) : (
                  <span style={{ color: '#888' }}>No trend data.</span>
                )}
              </div>
            </div>
          </div>
          
          <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '16px' }}>Cost if fighting continues</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '8px', border: '1px solid #eee' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', marginBottom: '4px' }}>Cost if fighting continues</div>
              <div style={{ fontSize: '1.1rem', color: '#333', fontWeight: 600 }}>
                {metrics.cost_continue_h5 ? `${metrics.cost_continue_h5.value > 0 ? '+' : ''}${Number(metrics.cost_continue_h5.value).toPrecision(2)}%` : 'Not available'}
              </div>
            </div>
            <div style={{ backgroundColor: '#fff0eb', padding: '12px', borderRadius: '8px', border: '1px solid #fbdcd0' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#AD4930', marginBottom: '4px' }}>Gain from stopping now</div>
              <div style={{ fontSize: '1.1rem', color: '#AD4930', fontWeight: 600 }}>
                {metrics.peace_dividend_h5 ? `+${Number(metrics.peace_dividend_h5.value).toPrecision(2)} pts` : 'Not available'}
              </div>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
