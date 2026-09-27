import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import { Info, ChevronDown } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './App.css';
import Chart from './Chart.jsx';
import baseCountriesData from './baseCountriesData.json';

const geoToAppName = {
  'The Bahamas': 'Bahamas',
  'Republic of the Congo': 'Congo',
  'Czech Republic': 'Czechia',
  'Guinea Bissau': 'Guinea-Bissau',
  'Macedonia': 'North Macedonia',
  'Republic of Serbia': 'Serbia',
  'Swaziland': 'Eswatini',
  'East Timor': 'Timor-Leste',
  'United Republic of Tanzania': 'Tanzania',
  'West Bank': 'Palestine'
};

// Map shapes join the data by 3-letter country code (names differ between sources:
// "Syria" vs "Syrian Arab Republic"). Names are only used for display.
const shapeCode = (feature) => {
  if (feature.id === 'CS-KM') return 'XKX'; // Kosovo: non-standard code in this shape file
  if (feature.properties.name === 'Somaliland') return 'SOM'; // no code; ACLED and the World Bank record it under Somalia
  return feature.id;
};
const appName = (shapeName) => geoToAppName[shapeName] || shapeName;

const NO_DATA_PATTERN = 'nodata-hatch';

/** Adds a diagonal-line <pattern> to Leaflet's SVG so no-data countries can be hatched. */
function NoDataPattern() {
  const map = useMap();
  useEffect(() => {
    const inject = () => {
      const svg = map.getPanes().overlayPane.querySelector('svg');
      if (!svg || svg.querySelector(`#${NO_DATA_PATTERN}`)) return;
      const ns = 'http://www.w3.org/2000/svg';
      const el = (tag, attrs) => {
        const e = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        return e;
      };
      const pattern = el('pattern', { id: NO_DATA_PATTERN, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' });
      pattern.appendChild(el('rect', { width: 6, height: 6, fill: '#4A433D' }));
      pattern.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'rgba(236, 230, 220, 0.4)', 'stroke-width': 1.5 }));
      const defs = el('defs', {});
      defs.appendChild(pattern);
      svg.insertBefore(defs, svg.firstChild);
    };
    inject();
    map.on('layeradd', inject); // the SVG appears when the first shape is added
    return () => map.off('layeradd', inject);
  }, [map]);
  return null;
}

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState('Forcibly Displaced People');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [openContinents, setOpenContinents] = useState({});
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountryForChart, setSelectedCountryForChart] = useState(null);
  const selectedLayerRef = useRef(null); // map shape currently outlined as selected
  const [metricsCatalog, setMetricsCatalog] = useState(null);
  const [mapMetrics, setMapMetrics] = useState(null);
  const [countryInfo, setCountryInfo] = useState(null); // code -> { name, status, ... } from map_metrics.json
  const [selectedCountryCode, setSelectedCountryCode] = useState(null);
  const [dropdownOptionsState, setDropdownOptionsState] = useState([]);





  useEffect(() => {
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
      .then(res => res.json())
      .then(data => setGeoJsonData(data))
      .catch(err => console.error("Error fetching GeoJSON:", err));
  }, []);

  // sidebar list: each listed name resolved to a code once, values looked up by code
  const countriesData = useMemo(() => {
    if (!metricsCatalog || !mapMetrics || !countryInfo) return baseCountriesData;
    const metricKey = Object.keys(metricsCatalog).find(k => metricsCatalog[k].label === selectedOption);
    if (!metricKey) return baseCountriesData;
    const rows = mapMetrics[metricKey] || {};

    // name -> code: the data file's own names, then the map shapes' friendly names (these win)
    const nameToCode = {};
    Object.entries(countryInfo).forEach(([code, info]) => { nameToCode[info.name] = code; });
    geoJsonData?.features.forEach(f => { nameToCode[appName(f.properties.name)] = shapeCode(f); });

    return baseCountriesData.map(c => {
      const iso3 = nameToCode[c.name] ?? null;
      const row = iso3 ? rows[iso3] : null;
      return {
        ...c,
        iso3,
        value: metricKey === 'intensity_12m' ? (row?.value == null ? null : row?.inputs?.pv_fatalities_12m ?? null) : (row?.value ?? null), // null = no data (not 0)
        note: row?.note ?? null,
        status: (iso3 && countryInfo[iso3]?.status) || 'unknown',
      };
    });
  }, [selectedOption, mapMetrics, metricsCatalog, countryInfo, geoJsonData]);
  const toggleContinent = (continent) => {
    setOpenContinents(prev => ({ ...prev, [continent]: !prev[continent] }));
  };



  useEffect(() => {
    fetch('/map_metrics.json')
      .then(res => res.json())
      .then(data => {
        setMetricsCatalog(data.catalog);
        setMapMetrics(data.metrics);
        setCountryInfo(data.countries);
        const options = Object.values(data.catalog).map(c => c.label);
        setDropdownOptionsState(options);
        setSelectedOption(options[0]);
      })
      .catch(err => console.error("Error fetching map metrics:", err));
  }, []);

  const groupedCountries = countriesData.reduce((acc, country) => {
    if (!acc[country.continent]) acc[country.continent] = [];
    acc[country.continent].push(country);
    return acc;
  }, {});


  const SEQ = ['#3B322B', '#5E4232', '#84502F', '#A8592B', '#C9772F', '#E0A15A'];
  const DIV = ['#6F8795', '#8E9DA5', '#5E5750', '#A8592B', '#C2412B'];
  const NO_DATA = '#4A433D';

  const SCALES = {
    intensity_12m: { kind: 'log', t: [10, 100, 1000, 10000, 50000] }, // total deaths, past 12 months
    extra_poor_h5: { kind: 'log', t: [1e3, 1e4, 1e5, 5e5, 2e6] },
    cost_continue_h5: { kind: 'sequential', abs: true, t: [0.5, 2, 5, 10, 20] },
    peace_dividend_h5: { kind: 'sequential', t: [0.5, 2, 5, 10, 20] },
    neighbor_exposure: { kind: 'sequential', abs: true, t: [0.1, 0.25, 0.5, 1, 2] },
    escalation_3m: { kind: 'diverging', t: [-0.5, -0.15, 0.15, 0.5] },
    unrest_z: { kind: 'diverging', t: [-1.5, -0.5, 0.5, 1.5] },
  };

  // country borders: faint bone white; the selected country gets a solid bone-white outline
  const BORDER = { color: 'rgba(236, 230, 220, 0.3)', weight: 0.6 };
  const SELECTED_BORDER = { color: '#ECE6DC', weight: 2 };

  const activeMetricKey = (metricsCatalog &&
    Object.keys(metricsCatalog).find(k => metricsCatalog[k].label === selectedOption)) || 'intensity_12m';
  const activeRows = mapMetrics?.[activeMetricKey] || {};
  // the number a layer colours by; Deadly violence uses total deaths (the file's value is per 100k)
  const valueFor = (key, row) => {
    if (!row || row.value == null || Number.isNaN(row.value)) return null;
    if (key === 'intensity_12m') return row.inputs?.pv_fatalities_12m ?? null;
    return row.value;
  };

  // Legend text per layer: readable numbers + a unit line; up/down layers use words
  const compactNum = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 2 });
  const LEGEND_FMT = {
    intensity_12m: (v) => compactNum.format(v),
    extra_poor_h5: (v) => compactNum.format(v),
    cost_continue_h5: (v) => `${v}%`,
    neighbor_exposure: (v) => `${v}%`,
    peace_dividend_h5: (v) => `${v} pts`,
  };
  const LEGEND_UNIT = {
    intensity_12m: 'people killed in political violence, past 12 months',
    escalation_3m: 'deaths in the past 3 months vs the 3 before',
    unrest_z: 'protests and riots vs the usual level (past 3 years)',
    cost_continue_h5: 'GDP per person lower after 5 years, if fighting continues',
    peace_dividend_h5: 'GDP per person saved after 5 years, if fighting stops now',
    extra_poor_h5: 'extra people below $2.15/day after 5 years',
    neighbor_exposure: 'GDP per person lower after 5 years, from nearby fighting',
  };
  const LEGEND_WORDS = {
    escalation_3m: ['Calming fast', 'Calming', 'Stable or too few deaths', 'Escalating', 'Escalating fast'],
    unrest_z: ['Much quieter', 'Quieter', 'Usual', 'More unrest', 'Much more unrest'],
  };

  // Tooltip text for every layer: the value in words, plus its likely range where there is one
  const bandIndex = (key, v) => {
    const t = (SCALES[key] || SCALES.intensity_12m).t;
    const i = t.findIndex(x => v <= x);
    return i === -1 ? t.length : i;
  };
  const pct = (v) => `${Math.abs(v) < 1 ? Math.abs(v).toFixed(1) : Math.round(Math.abs(v))}%`;
  const signedPct = (v) => `${v < 0 ? '\u2212' : '+'}${pct(v)}`;
  const tooltipHtml = (name, key, row, extra) => {
    const head = `<div class="tip-name">${name}${extra}</div>`;
    const v = valueFor(key, row);
    if (v == null) {
      const reason = row?.note ? `: ${row.note}` : '';
      return `${head}<div class="tip-muted">No data${reason}</div>`;
    }
    const range = (fmt) => (row.lo != null && row.hi != null && row.lo !== row.hi
      ? `<div class="tip-range">likely range: ${fmt(row.lo)} to ${fmt(row.hi)}</div>` : '');
    let body;
    switch (key) {
      case 'intensity_12m':
        body = `<b>${compactNum.format(v)}</b> people killed in the past 12 months`
          + `<div class="tip-range">${row.value >= 10 ? Math.round(row.value) : Number(row.value).toPrecision(2)} per 100,000 people</div>`;
        break;
      case 'escalation_3m': {
        if (tooFewForTrend(row)) {
          body = '<b>Too few deaths to show a trend</b><div class="tip-range">fewer than 25 in the last 6 months</div>';
          break;
        }
        const change = Math.round((Math.exp(v) - 1) * 100);
        body = `<b>${LEGEND_WORDS.escalation_3m[bandIndex(key, v)]}</b>`
          + `<div class="tip-range">deaths ${change >= 0 ? 'up' : 'down'} about ${Math.abs(change)}% vs the 3 months before</div>`;
        break;
      }
      case 'unrest_z':
        body = `<b>${['Much quieter than usual', 'Quieter than usual', 'About the usual level', 'More unrest than usual', 'Much more unrest than usual'][bandIndex(key, v)]}</b>`
          + '<div class="tip-range">protests and riots, past 3 months vs the past 3 years</div>';
        break;
      case 'cost_continue_h5':
        body = Math.abs(v) < 0.05
          ? 'No measurable cost to GDP per person (little or no fighting)'
          : `GDP per person about <b>${pct(v)} ${v <= 0 ? 'lower' : 'higher'}</b> in 5 years if fighting continues${range(signedPct)}`;
        break;
      case 'peace_dividend_h5':
        body = `<b>${v.toFixed(1)} pts</b> of GDP per person saved in 5 years if fighting stops now${range(x => `${x.toFixed(1)} pts`)}`;
        break;
      case 'extra_poor_h5':
        body = `about <b>${compactNum.format(Math.max(0, v))}</b> more people in extreme poverty after 5 years${range(x => compactNum.format(Math.max(0, x)))}`;
        break;
      case 'neighbor_exposure':
        body = `GDP per person about <b>${pct(v)} lower</b> in 5 years from fighting nearby${range(signedPct)}`;
        break;
      default:
        body = `${v}`;
    }
    return `${head}<div class="tip-body">${body}</div>`;
  };

  // escalation needs enough deaths to mean anything (0 -> 1 death is "+100%")
  const tooFewForTrend = (row) =>
    (row?.inputs?.fatalities_last_3m ?? 0) + (row?.inputs?.fatalities_prev_3m ?? 0) < 25;

  const getColor = (code) => {
    const row = code ? activeRows[code] : null;
    const value = valueFor(activeMetricKey, row);
    if (value == null) return NO_DATA;
    if (activeMetricKey === 'escalation_3m' && tooFewForTrend(row)) return DIV[2]; // neutral, not "escalating"

    const s = SCALES[activeMetricKey] || SCALES.intensity_12m;
    const v = s.abs ? Math.abs(value) : value;
    let i = s.t.findIndex(t => v <= t);
    if (i === -1) i = s.t.length;
    
    if (s.kind === 'diverging') return DIV[i];
    if (s.kind === 'log' && value <= 0) return SEQ[0];
    return SEQ[i];
  };
  return (
    <>
        {/* Map area in the middle */}
        <div className="map-area">
          <div className={`map-legend ${isMenuOpen ? 'pushed-up' : ''}`}>
            <div className="legend-title">{selectedOption}</div>
            {LEGEND_UNIT[activeMetricKey] && <div className="legend-unit">{LEGEND_UNIT[activeMetricKey]}</div>}
            <div className="legend-scale">
              {(() => {
                const s = SCALES[activeMetricKey] || SCALES.intensity_12m;
                const colors = s.kind === 'diverging' ? DIV : SEQ;
                const fmt = LEGEND_FMT[activeMetricKey] || ((v) => `${v}`);
                const words = LEGEND_WORDS[activeMetricKey];
                const items = colors.map((color, i) => {
                  const lo = i === 0 ? null : s.t[i - 1];
                  const hi = i < s.t.length ? s.t[i] : null;
                  let label;
                  if (words) label = words[i];
                  else if (lo == null) label = `Up to ${fmt(hi)}`;
                  else if (hi == null) label = `Over ${fmt(lo)}`;
                  else label = `${fmt(lo)} to ${fmt(hi)}`;
                  return (
                    <div className="legend-item" key={i}>
                      <div className="legend-color" style={{ backgroundColor: color }}></div>
                      <span>{label}</span>
                    </div>
                  );
                });
                return words ? items.reverse() : items; // up/down layers: "worse" at the top
              })()}
              <div className="legend-item">
                <div className="legend-color legend-nodata"></div>
                <span>No data</span>
              </div>
            </div>
          </div>
          <MapContainer 
            center={[0, 0]} 
            zoom={2} 
            minZoom={2}
            maxBounds={[[-90, -180], [90, 180]]}
            maxBoundsViscosity={1.0}
            scrollWheelZoom={true} 
            style={{ height: "100%", width: "100%", zIndex: 0 }}
          >
            <NoDataPattern />
            {geoJsonData && (
              <GeoJSON
                key={selectedOption + (mapMetrics ? ':loaded' : '')}
                data={geoJsonData}
                filter={(feature) => feature.properties.name !== 'Antarctica'}
                style={(feature) => {
                  const code = shapeCode(feature);
                  const color = getColor(code);
                  return {
                    fillColor: color === NO_DATA ? `url(#${NO_DATA_PATTERN})` : color,
                    fillOpacity: 1,
                    ...(code && code === selectedCountryCode ? SELECTED_BORDER : BORDER),
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const mappedName = appName(feature.properties.name); // display only
                  const code = shapeCode(feature);
                  if (code && code === selectedCountryCode) selectedLayerRef.current = layer;
                  layer.on({
                    click: () => {
                      // outline the clicked country (not a focus box) and draw it above its neighbours
                      selectedLayerRef.current?.setStyle(BORDER);
                      layer.setStyle(SELECTED_BORDER);
                      layer.bringToFront();
                      selectedLayerRef.current = layer;
                      if (mappedName) {
                        setSelectedCountryForChart(mappedName);
                        setSelectedCountryCode(code);
                        setIsMenuOpen(true); // Ensure sidebar is open on mobile
                      }
                    },
                  });
                  if (mappedName) {
                    const row = code ? activeRows[code] : null;
                    const shared = feature.properties.name === 'Somaliland' ? " (shown with Somalia's data)" : '';
                    layer.bindTooltip(tooltipHtml(mappedName, activeMetricKey, row, shared), { sticky: true, className: 'map-tip' });
                  }
                }}
              />
            )}
          </MapContainer>
        </div>
        
        {/* Right nav bar or mobile pullup */}
        <div className={`nav-sidebar ${isMenuOpen ? 'open' : ''}`}>
          <div className="menu-handle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <div className="handle-bar"></div>
            <span className="handle-text">{isMenuOpen ? 'Close Menu' : 'Open Menu'}</span>
          </div>
          <div className="sidebar-content">
            {selectedCountryForChart ? (
              <Chart country={selectedCountryForChart} iso3={selectedCountryCode} onClose={() => { setSelectedCountryForChart(null); setSelectedCountryCode(null); }} />
            ) : (
              <>
            {/* top dropdown & info */}
            <div className="sidebar-top-controls">
              <div className="custom-dropdown">
                <div 
                  className="dropdown-trigger" 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span>{selectedOption}</span>
                  <ChevronDown size={16} />
                </div>
                
                {isDropdownOpen && (
                  <div className="dropdown-menu">
                    {dropdownOptionsState.map((option) => (
                      <div 
                        key={option}
                        className="dropdown-item"
                        onClick={() => {
                          setSelectedOption(option);
                          setIsDropdownOpen(false);
                        }}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="info-container">
                <button 
                  className="info-button" 
                  onClick={() => setIsInfoOpen(!isInfoOpen)}
                  title="Information"
                >
                  <Info size={24} color="currentColor" />
                </button>
                
                {isInfoOpen && (
                  <div className="info-bubble">
                    <p>
                      {metricsCatalog ? Object.values(metricsCatalog).find(c => c.label === selectedOption)?.meaning : ""}
                    </p>
                    {/* triangle thing */}
                    <div className="info-bubble-pointer" />
                  </div>
                )}
              </div>
            </div>

            <div className="countries-list-container">
              <div className="search-container" style={{ marginBottom: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Search countries..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="country-search-input"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #3A322B',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: '#2B241F',
                    color: '#ECE6DC'
                  }}
                />
              </div>
              <h3 className="countries-title">Countries</h3>
              
              {searchQuery.trim() === '' ? (
                <div className="continents-accordion">
                  {Object.keys(groupedCountries).sort().map(continent => (
                    <div key={continent} className="continent-section">
                      <div 
                        className="continent-header"
                        onClick={() => toggleContinent(continent)}
                      >
                        <span>{continent}</span>
                        <ChevronDown 
                          size={16} 
                          className={`chevron ${openContinents[continent] ? 'open' : ''}`}
                        />
                      </div>
                      {openContinents[continent] && (
                        <ul className="countries-list">
                          {groupedCountries[continent].map((country, index) => (
                            <li 
                              key={index} 
                              className="country-item"
                              onClick={() => { setSelectedCountryForChart(country.name); setSelectedCountryCode(country.iso3); }}
                              style={{ cursor: 'pointer' }}
                            >
                              <span className="country-name">{country.name}</span>
                              <span className="country-value">{country.value == null ? '–' : country.value.toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="countries-list" style={{ marginTop: '0' }}>
                  {countriesData
                    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((country, index) => (
                      <li 
                        key={index} 
                        className="country-item"
                        onClick={() => { setSelectedCountryForChart(country.name); setSelectedCountryCode(country.iso3); }}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="country-name">{country.name}</span>
                        <span className="country-value">{country.value == null ? '–' : country.value.toLocaleString()}</span>
                      </li>
                    ))
                  }
                  {countriesData.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '10px', color: '#A89F94' }}>No countries found.</div>
                  )}
                </ul>
              )}
            </div>
            </>
            )}
          </div>
        </div>
      </>
  )
}

export default App
