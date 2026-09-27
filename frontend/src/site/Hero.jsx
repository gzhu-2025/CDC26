import { useState } from 'react'
import { MapContainer, ZoomControl } from 'react-leaflet'
import { ChevronDown } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import ChoroplethLayer from '../map-layers/ChoroplethLayer.jsx'
import MapLegend from '../map-layers/MapLegend.jsx'
import { ScrollSafe } from './useScrollSafeMap.js'

export default function Hero({
  ref, metric, info, layer, asOf, hero, error, selected, onSelect, onBackgroundClick, onScrollCue,
}) {
  const [hint, setHint] = useState(null)
  return (
    <section className="hero" ref={ref} aria-label="World map of conflict">
      <MapContainer
        center={[18, 12]}
        zoom={2}
        minZoom={2}
        maxBounds={[[-75, -200], [85, 200]]}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={false}
        zoomSnap={0.5}
        zoomControl={false}
        attributionControl
        className="hero-map"
      >
        <ScrollSafe onHint={setHint} />
        <ZoomControl position="topright" />
        {layer.metric === metric && (
          <ChoroplethLayer
            metric={metric}
            values={layer.values}
            info={info}
            selected={selected}
            onSelect={onSelect}
            onBackgroundClick={onBackgroundClick}
          />
        )}
      </MapContainer>

      {hint && <div className="map-hint" role="status">{hint}</div>}
      {error && <div className="map-status">Map data unavailable: {error}</div>}

      {hero && (
        <aside className="hero-numbers" aria-label="Right now">
          {hero.map((h) => (
            <div key={h.id} className="hero-number">
              <span className="hn-value">{h.display}</span>
              <span className="hn-text">{h.text}</span>
            </div>
          ))}
          <div className="hn-asof">As of {hero[0]?.as_of}</div>
        </aside>
      )}

      <MapLegend metric={metric} info={info} asOf={asOf} />

      <button type="button" className="scroll-cue" onClick={onScrollCue}>
        <span>Scroll for what the data shows</span>
        <ChevronDown size={20} aria-hidden="true" />
      </button>
    </section>
  )
}
