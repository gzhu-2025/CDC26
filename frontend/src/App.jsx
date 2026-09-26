import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { Info, ChevronDown } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './App.css';


function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState('Forcibly Displaced People');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [openContinents, setOpenContinents] = useState({});

  const toggleContinent = (continent) => {
    setOpenContinents(prev => ({ ...prev, [continent]: !prev[continent] }));
  };


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
      "Individuals or groups forced to flee their homes. This is often due to armed conflict, violence, or disasters. These remain within their own country's internationally recognized borders.",

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

  const [countriesData, setCountriesData] = useState(
[
      {
        "name": "Afghanistan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Albania",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Algeria",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Andorra",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Angola",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Antigua and Barbuda",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Argentina",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Armenia",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Australia",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Austria",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Azerbaijan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Bahamas",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Bahrain",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Bangladesh",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Barbados",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Belarus",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Belgium",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Belize",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Benin",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Bhutan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Bolivia",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Bosnia and Herzegovina",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Botswana",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Brazil",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Brunei",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Bulgaria",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Burkina Faso",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Burundi",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Cabo Verde",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Cambodia",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Cameroon",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Canada",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Central African Republic",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Chad",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Chile",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "China",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Colombia",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Comoros",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Congo",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Costa Rica",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Croatia",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Cuba",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Cyprus",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Czechia",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Democratic Republic of the Congo",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Denmark",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Djibouti",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Dominica",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Dominican Republic",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Ecuador",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Egypt",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "El Salvador",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Equatorial Guinea",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Eritrea",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Estonia",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Eswatini",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Ethiopia",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Fiji",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Finland",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "France",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Gabon",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Gambia",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Georgia",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Germany",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Ghana",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Greece",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Grenada",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Guatemala",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Guinea",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Guinea-Bissau",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Guyana",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Haiti",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Honduras",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Hungary",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Iceland",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "India",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Indonesia",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Iran",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Iraq",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Ireland",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Israel",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Italy",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Jamaica",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Japan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Jordan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Kazakhstan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Kenya",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Kiribati",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Kuwait",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Kyrgyzstan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Laos",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Latvia",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Lebanon",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Lesotho",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Liberia",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Libya",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Liechtenstein",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Lithuania",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Luxembourg",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Madagascar",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Malawi",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Malaysia",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Maldives",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Mali",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Malta",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Marshall Islands",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Mauritania",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Mauritius",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Mexico",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Micronesia",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Moldova",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Monaco",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Mongolia",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Montenegro",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Morocco",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Mozambique",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Myanmar",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Namibia",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Nauru",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Nepal",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Netherlands",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "New Zealand",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Nicaragua",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Niger",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Nigeria",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "North Korea",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "North Macedonia",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Norway",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Oman",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Pakistan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Palau",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Palestine",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Panama",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Papua New Guinea",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Paraguay",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Peru",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Philippines",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Poland",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Portugal",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Qatar",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Romania",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Russia",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Rwanda",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Saint Kitts and Nevis",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Saint Lucia",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Saint Vincent and the Grenadines",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Samoa",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "San Marino",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Sao Tome and Principe",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Saudi Arabia",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Senegal",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Serbia",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Seychelles",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Sierra Leone",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Singapore",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Slovakia",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Slovenia",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Solomon Islands",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Somalia",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "South Africa",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "South Korea",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "South Sudan",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Spain",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Sri Lanka",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Sudan",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Suriname",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Sweden",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Switzerland",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Syria",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Taiwan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Tajikistan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Tanzania",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Thailand",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Timor-Leste",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Togo",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Tonga",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Trinidad and Tobago",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Tunisia",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Turkey",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Turkmenistan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Tuvalu",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Uganda",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Ukraine",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "United Arab Emirates",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "United Kingdom",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "United States of America",
        "value": 0,
        "continent": "North America"
      },
      {
        "name": "Uruguay",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Uzbekistan",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Vanuatu",
        "value": 0,
        "continent": "Oceania"
      },
      {
        "name": "Vatican City",
        "value": 0,
        "continent": "Europe"
      },
      {
        "name": "Venezuela",
        "value": 0,
        "continent": "South America"
      },
      {
        "name": "Vietnam",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Yemen",
        "value": 0,
        "continent": "Asia"
      },
      {
        "name": "Zambia",
        "value": 0,
        "continent": "Africa"
      },
      {
        "name": "Zimbabwe",
        "value": 0,
        "continent": "Africa"
      }
    ]
  );

  const groupedCountries = countriesData.reduce((acc, country) => {
    if (!acc[country.continent]) acc[country.continent] = [];
    acc[country.continent].push(country);
    return acc;
  }, {});


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

            <div className="countries-list-container">
              <h3 className="countries-title">Countries</h3>
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
                          <li key={index} className="country-item">
                            <span className="country-name">{country.name}</span>
                            <span className="country-value">{country.value.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Bar (Moved to top on mobile) */}
      <div className="bottom-bar">
        <h3>US has bombed Chad...</h3>
      </div>
    </div>
  )
}

export default App
