import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css'

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="app-container">
      <div className="main-content">
        {/* Map Area in the middle */}
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
        
        {/* Right Nav Bar / Pull-up Menu */}
        <div className={`nav-sidebar ${isMenuOpen ? 'open' : ''}`}>
          <div className="menu-handle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <div className="handle-bar"></div>
            <span className="handle-text">{isMenuOpen ? 'Close Menu' : 'Open Menu'}</span>
          </div>
          <div className="sidebar-content">
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
