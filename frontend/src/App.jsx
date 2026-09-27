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

  const minVal = Math.min(...countriesData.map(c => c.value));
  const maxVal = Math.max(...countriesData.map(c => c.value));
  
  const getColor = (countryName) => {
    const country = countriesData.find(c => c.name === countryName);
    if (!country) return '#cccccc'; // default gray
    const val = country.value;
    if (minVal === maxVal) return 'rgb(255, 255, 0)';
    
    const ratio = (val - minVal) / (maxVal - minVal);
    let r, g, b = 0;
    if (ratio < 0.5) {
      const normalizedRatio = ratio * 2;
      r = 255;
      g = Math.round(normalizedRatio * 255);
    } else {
      const normalizedRatio = (ratio - 0.5) * 2;
      r = Math.round(255 - (normalizedRatio * 255));
      g = 255;
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <>
        {/* Map area in the middle */}
        <div className="map-area">
          <div className="map-legend">
            <div className="legend-title">Legend</div>
            <div className="legend-scale">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: 'rgb(255, 0, 0)' }}></div>
                <span>Min: {minVal}</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: 'rgb(255, 255, 0)' }}></div>
                <span>Mid: {Math.round((minVal + maxVal) / 2)}</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: 'rgb(0, 255, 0)' }}></div>
                <span>Max: {maxVal}</span>
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
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
