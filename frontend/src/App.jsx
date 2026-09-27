import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
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

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState('Forcibly Displaced People');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [openContinents, setOpenContinents] = useState({});
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountryForChart, setSelectedCountryForChart] = useState(null);
  const [countriesData, setCountriesData] = useState(baseCountriesData);
  const [metricsCatalog, setMetricsCatalog] = useState(null);
  const [mapMetrics, setMapMetrics] = useState(null);
  const [dropdownOptionsState, setDropdownOptionsState] = useState([]);





  useEffect(() => {
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
      .then(res => res.json())
      .then(data => setGeoJsonData(data))
      .catch(err => console.error("Error fetching GeoJSON:", err));
  }, []);

  useEffect(() => {
    if (!metricsCatalog || !mapMetrics) return;
    
    // Find the metric key for the selected option label
    const metricKey = Object.keys(metricsCatalog).find(k => metricsCatalog[k].label === selectedOption);
    if (!metricKey) return;
    
        // We already have mapMetrics in state, no need to fetch!
        // But wait, we need data.countries from mapMetrics? No, we don't have data.countries. We only saved mapMetrics!
        // Let's just fetch it, it's fine, it's cached by the browser anyway. 
        // Actually, let's fetch it, but we can avoid the second fetch by just saving the whole json into a state called fullData.
        // Let's just keep the fetch, but change data.catalog to metricsCatalog, data.metrics to mapMetrics.
        // Wait, data is the fetched json. It has data.countries. It's fine to fetch.
        fetch('/map_metrics.json')
          .then(res => res.json())
          .then(data => {
            setCountriesData(baseCountriesData.map(c => {
              let value = null;
              let status = "unknown";
              let iso3 = null;
              
              for (const [code, info] of Object.entries(data.countries)) {
                if (info.name === c.name || (geoToAppName && geoToAppName[info.name] === c.name)) {
                  iso3 = code;
                  status = info.status;
                  break;
                }
              }
              
              if (iso3 && data.metrics[metricKey] && data.metrics[metricKey][iso3]) {
                value = data.metrics[metricKey][iso3].value;
              }
              
              return { ...c, value: value || 0, status, iso3 };
            }));
          });
  }, [selectedOption, mapMetrics, metricsCatalog]);
  const toggleContinent = (continent) => {
    setOpenContinents(prev => ({ ...prev, [continent]: !prev[continent] }));
  };



  useEffect(() => {
    fetch('/map_metrics.json')
      .then(res => res.json())
      .then(data => {
        setMetricsCatalog(data.catalog);
        setMapMetrics(data.metrics);
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


  const SEQ = ['#FFEDA0', '#FED976', '#FEB24C', '#FD8D3C', '#FC4E2A', '#B10026'];
  const DIV = ['#1A9850', '#91CF60', '#FFFFBF', '#FC8D59', '#D73027'];
  const NO_DATA = '#cccccc';

  const SCALES = {
    intensity_12m: { kind: 'log', t: [0.1, 0.5, 2, 10, 50] },
    extra_poor_h5: { kind: 'log', t: [1e3, 1e4, 1e5, 5e5, 2e6] },
    cost_continue_h5: { kind: 'sequential', abs: true, t: [0.5, 2, 5, 10, 20] },
    peace_dividend_h5: { kind: 'sequential', t: [0.5, 2, 5, 10, 20] },
    neighbor_exposure: { kind: 'sequential', abs: true, t: [0.1, 0.25, 0.5, 1, 2] },
    escalation_3m: { kind: 'diverging', t: [-0.5, -0.15, 0.15, 0.5] },
    unrest_z: { kind: 'diverging', t: [-1.5, -0.5, 0.5, 1.5] },
  };

  const getColor = (countryName) => {
    const country = countriesData.find(c => c.name === countryName);
    if (!country || country.value == null || Number.isNaN(country.value)) return NO_DATA;
    
    let metricKey = 'intensity_12m';
    if (metricsCatalog) {
      const found = Object.keys(metricsCatalog).find(k => metricsCatalog[k].label === selectedOption);
      if (found) metricKey = found;
    }
    
    const s = SCALES[metricKey] || SCALES.intensity_12m;
    const value = country.value;
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
            <div className="legend-scale">
              {(() => {
                let metricKey = 'intensity_12m';
                if (metricsCatalog) {
                  const found = Object.keys(metricsCatalog).find(k => metricsCatalog[k].label === selectedOption);
                  if (found) metricKey = found;
                }
                const s = SCALES[metricKey] || SCALES.intensity_12m;
                const colors = s.kind === 'diverging' ? DIV : SEQ;
                return colors.map((color, i) => {
                  const lo = i === 0 ? null : s.t[i - 1];
                  const hi = i < s.t.length ? s.t[i] : null;
                  let label = '';
                  if (lo == null) label = `Up to ${hi}`;
                  else if (hi == null) label = `Over ${lo}`;
                  else label = `${lo} to ${hi}`;
                  
                  return (
                    <div className="legend-item" key={i}>
                      <div className="legend-color" style={{ backgroundColor: color }}></div>
                      <span>{label}</span>
                    </div>
                  );
                });
              })()}
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
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {geoJsonData && (
              <GeoJSON
                key={countriesData.map(c => c.value).join(',')}
                data={geoJsonData}
                filter={(feature) => feature.properties.name !== 'Antarctica'}
                style={(feature) => ({
                  fillColor: getColor(geoToAppName[feature.properties.name] || feature.properties.name),
                  color: 'black',
                  weight: 1,
                  fillOpacity: 0.7
                })}
                onEachFeature={(feature, layer) => {
                  const mappedName = geoToAppName[feature.properties.name] || feature.properties.name;
                  layer.on({
                    click: () => {
                      if (mappedName) {
                        setSelectedCountryForChart(mappedName);
                        setIsMenuOpen(true); // Ensure sidebar is open on mobile
                      }
                    },
                  });
                  if (mappedName) {
                    layer.bindTooltip(mappedName);
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
              <Chart country={selectedCountryForChart} onClose={() => setSelectedCountryForChart(null)} />
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
                  <Info size={24} color="black" />
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
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: '#fafafa',
                    color: '#333'
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
                              onClick={() => setSelectedCountryForChart(country.name)}
                              style={{ cursor: 'pointer' }}
                            >
                              <span className="country-name">{country.name}</span>
                              <span className="country-value">{country.value.toLocaleString()}</span>
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
                        onClick={() => setSelectedCountryForChart(country.name)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="country-name">{country.name}</span>
                        <span className="country-value">{country.value.toLocaleString()}</span>
                      </li>
                    ))
                  }
                  {countriesData.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '10px', color: '#666' }}>No countries found.</div>
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
