import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { Info, ChevronDown } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './App.css'

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState('LDP');
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const dropdownOptions = [
    "Forcibly Displaced People",
    "Internally Displaced People",
    "Poverty Headcount",
    "Vulnerable Headcount",
    "GDP",
    "Individual Consumption Expenditure by Households",
    "Rural Access to Electricity",
    "Urban Access to Electricity",
    "Other People in Need of International Protection"
  ];

  const dropdownOptionsInfo = {
    "Forcibly Displaced People":
      "The total number of individuals forced to flee their homes due to persecution, conflict, generalized violence, or human rights violations. This umbrella category includes refugees, asylum seekers, and internally displaced persons (IDPs).",

    "Internally Displaced People":
      "Individuals or groups forced to flee their homes—often due to armed conflict, violence, or disasters—who remain within their own country's internationally recognized borders.",

    "Poverty Headcount":
      "The percentage or total number of the population living below a specified poverty line (such as the international extreme poverty line of $2.15 per day or a defined national threshold).",

    "Vulnerable Headcount":
      "The share or count of people living just above the poverty line who are at high risk of falling into poverty due to economic, climatic, or health-related shocks.",

    "GDP":
      "Gross Domestic Product: The total monetary or market value of all finished goods and services produced within a country's borders during a specific period.",

    "Individual Consumption Expenditure by Households":
      "The total market value of all goods and services purchased directly by resident households to satisfy everyday individual needs and wants, excluding purchases by government or non-profits.",

    "Rural Access to Electricity":
      "The percentage of the rural population with access to electricity, typically measured through grid connections or standalone off-grid power systems.",

    "Urban Access to Electricity":
      "The percentage of the urban population with access to electricity, representing electrification coverage in designated cities and metropolitan areas."
  };


  return (
    <div className="app-container">
      <div className="main-content">
        {/* Map area in the middle */}
        <div className="map-area">
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
          </MapContainer>
        </div>
        
        {/* Right nav bar or mobile pullup */}
        <div className={`nav-sidebar ${isMenuOpen ? 'open' : ''}`}>
          <div className="menu-handle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <div className="handle-bar"></div>
            <span className="handle-text">{isMenuOpen ? 'Close Menu' : 'Open Menu'}</span>
          </div>
          <div className="sidebar-content">
            
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
                    {dropdownOptions.map((option) => (
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
                      {dropdownOptionsInfo[selectedOption]}
                    </p>
                    {/* triangle thing */}
                    <div className="info-bubble-pointer" />
                  </div>
                )}
              </div>
            </div>

            <h3>Right Nav Bar</h3>
          </div>
        </div>
      </div>
      
      {/* Bottom Bar (Moved to top on mobile) */}
      <div className="bottom-bar">
        <h3>Bottom Bar</h3>
      </div>
    </div>
  )
}

export default App
