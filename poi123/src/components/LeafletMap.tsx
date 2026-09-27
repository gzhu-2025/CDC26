import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { CountryData, IndicatorType, Region } from '../types';
import { 
  Layers, 
  MapPin, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Filter, 
  ShieldAlert, 
  TrendingUp, 
  Users, 
  Info,
  Maximize2,
  Compass,
  ArrowRight,
  Satellite,
  Mountain,
  Map as MapIcon,
  Flag
} from 'lucide-react';

interface LeafletMapProps {
  countries: CountryData[];
  selectedCountry: CountryData | null;
  onSelectCountry: (country: CountryData) => void;
  selectedRegion: Region;
  onSelectRegion: (region: Region) => void;
  activeMetric: IndicatorType;
  setActiveMetric: (metric: IndicatorType) => void;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  countries,
  selectedCountry,
  onSelectCountry,
  selectedRegion,
  onSelectRegion,
  activeMetric,
  setActiveMetric,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const pulseGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.TileLayer | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('All');
  // Default to 'political' to ensure the political map works and is active on load
  const [mapStyle, setMapStyle] = useState<'political' | 'natgeo' | 'satellite' | 'dark'>('political');
  const [hoveredCountry, setHoveredCountry] = useState<CountryData | null>(null);

  // Region center coordinates and zoom levels
  const regionViews: Record<Region, { center: [number, number]; zoom: number }> = {
    'All': { center: [20, 15], zoom: 2.5 },
    'Middle East & North Africa': { center: [28, 42], zoom: 4.2 },
    'Sub-Saharan Africa': { center: [2, 24], zoom: 3.8 },
    'Eastern Europe & Eurasia': { center: [49, 35], zoom: 4.2 },
    'South & Southeast Asia': { center: [22, 85], zoom: 4.0 },
    'Latin America & Caribbean': { center: [-5, -70], zoom: 3.5 },
    'North America & Europe': { center: [48, -40], zoom: 3.2 },
  };

  // Color calculation based on active metric
  const getMetricColor = (country: CountryData) => {
    switch (activeMetric) {
      case 'conflict': {
        const val = country.currentConflictIntensity;
        if (val > 80) return '#EF4444'; // Red
        if (val > 60) return '#F97316'; // Orange
        if (val > 35) return '#F59E0B'; // Amber
        if (val > 15) return '#3B82F6'; // Blue
        return '#10B981'; // Emerald
      }
      case 'gdp': {
        const val = country.currentGdpPerCapita;
        if (val > 40000) return '#10B981'; // Emerald
        if (val > 15000) return '#06B6D4'; // Cyan
        if (val > 5000) return '#3B82F6'; // Blue
        if (val > 1500) return '#F59E0B'; // Amber
        return '#EF4444'; // Red
      }
      case 'hdi': {
        const val = country.currentHdi;
        if (val >= 0.85) return '#10B981';
        if (val >= 0.70) return '#06B6D4';
        if (val >= 0.55) return '#F59E0B';
        return '#EF4444';
      }
      case 'hci': {
        const val = country.currentHciPlus;
        if (val >= 210) return '#10B981'; // Emerald (Frontier High: 210-325)
        if (val >= 160) return '#8B5CF6'; // Violet (Upper-Medium: 160-210)
        if (val >= 100) return '#F59E0B'; // Amber (Developing: 100-160)
        return '#EF4444'; // Red (Severe Deficit / Conflict Shock: <100)
      }
      case 'displacement': {
        const val = country.currentDisplaced;
        if (val > 5000) return '#DC2626';
        if (val > 2000) return '#EA580C';
        if (val > 500) return '#D97706';
        if (val > 50) return '#64748B';
        return '#334155';
      }
      case 'military': {
        const val = country.currentMilitaryExp;
        if (val >= 10.0) return '#EF4444';
        if (val >= 4.0) return '#F97316';
        if (val >= 2.0) return '#F59E0B';
        return '#10B981';
      }
      case 'foodInsecurity': {
        const val = country.currentUndernourished;
        if (val >= 35.0) return '#DC2626';
        if (val >= 20.0) return '#EA580C';
        if (val >= 10.0) return '#F59E0B';
        return '#10B981';
      }
      case 'outOfSchool': {
        const val = country.currentOutOfSchool;
        if (val >= 35.0) return '#DC2626';
        if (val >= 20.0) return '#EA580C';
        if (val >= 10.0) return '#F59E0B';
        return '#10B981';
      }
      case 'healthCoverage': {
        const val = country.currentHealthCoverage;
        if (val >= 80) return '#10B981';
        if (val >= 65) return '#06B6D4';
        if (val >= 45) return '#F59E0B';
        return '#EF4444';
      }
      default:
        return '#3B82F6';
    }
  };

  // Filter countries by region and status
  const visibleCountries = useMemo(() => {
    return countries.filter(c => {
      const matchRegion = selectedRegion === 'All' || c.region === selectedRegion;
      const matchStatus = statusFilter === 'All' || c.conflictStatus === statusFilter;
      return matchRegion && matchStatus;
    });
  }, [countries, selectedRegion, statusFilter]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialView = regionViews[selectedRegion] || regionViews['All'];
      const map = L.map(mapContainerRef.current, {
        center: initialView.center,
        zoom: initialView.zoom,
        zoomControl: false,
        minZoom: 2,
        maxZoom: 12,
        worldCopyJump: true,
      });

      // Layer groups
      pulseGroupRef.current = L.layerGroup().addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      // Invalidate size immediately and with small delays to ensure zero-blank rendering
      map.invalidateSize();
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 300);

      const handleResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer and Boundaries Overlay based on user's choice
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    if (overlayLayerRef.current) {
      map.removeLayer(overlayLayerRef.current);
      overlayLayerRef.current = null;
    }

    if (mapStyle === 'political') {
      // 1. Primary Political Map: CartoDB Voyager with political boundaries and country labels
      tileLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);

      // Add high-contrast sovereign borders & place labels overlay
      overlayLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png',
        {
          attribution: '',
          subdomains: 'abcd',
          maxZoom: 19,
          opacity: 0.95,
        }
      ).addTo(map);

    } else if (mapStyle === 'natgeo') {
      // 2. National Geographic Classic Political World Map
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; National Geographic, Esri, DeLorme, NAVTEQ',
          maxZoom: 16,
        }
      ).addTo(map);

    } else if (mapStyle === 'satellite') {
      // 3. High-precision Esri World Imagery (Real-world satellite photography)
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, Maxar, Earthstar Geographics, USDA, USGS',
          maxZoom: 18,
        }
      ).addTo(map);

      // Add real-world international boundaries & place labels overlay
      overlayLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '',
          maxZoom: 18,
          opacity: 0.85,
        }
      ).addTo(map);

    } else if (mapStyle === 'dark') {
      // 4. Tactical Dark Political Map
      tileLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        {
          attribution: '&copy; CARTO &copy; OpenStreetMap',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);
    }
  }, [mapStyle]);

  // Handle Region flyTo changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const view = regionViews[selectedRegion];
    if (view) {
      map.flyTo(view.center, view.zoom, { duration: 1.2 });
    }
  }, [selectedRegion]);

  // Render Markers and Pulsing Circles on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    const pulseGroup = pulseGroupRef.current;
    if (!map || !layerGroup || !pulseGroup) return;

    layerGroup.clearLayers();
    pulseGroup.clearLayers();

    visibleCountries.forEach(country => {
      const color = getMetricColor(country);
      const isSelected = selectedCountry?.id === country.id;
      const conflictScore = country.currentConflictIntensity;

      // Base radius calculation
      const radius = Math.max(7, Math.min(22, Math.sqrt(conflictScore) * 2.2));

      // 1. Pulsing radar ripple for severe active war zones
      if (conflictScore >= 75) {
        const pulseIcon = L.divIcon({
          className: 'custom-pulse-wrapper',
          html: `<div class="conflict-pulse-marker" style="width: ${radius * 2.8}px; height: ${radius * 2.8}px; background-color: ${color}; margin-left: -${radius * 1.4}px; margin-top: -${radius * 1.4}px;"></div>`,
          iconSize: [0, 0],
        });
        L.marker([country.lat, country.lng], { icon: pulseIcon, interactive: false }).addTo(pulseGroup);
      }

      // 2. Interactive Circle Marker with high contrast border (dark outline on light maps, white on hover/select)
      const isLightMap = mapStyle === 'political' || mapStyle === 'natgeo';
      const circle = L.circleMarker([country.lat, country.lng], {
        radius: isSelected ? radius * 1.25 : radius,
        fillColor: color,
        color: isSelected ? '#FFFFFF' : isLightMap ? '#0F172A' : '#0B0F17',
        weight: isSelected ? 3.5 : isLightMap ? 2.0 : 1.5,
        opacity: 1,
        fillOpacity: isSelected ? 0.98 : 0.88,
      });

      // Leaflet Popup content
      const popupHtml = `
        <div style="min-width: 240px; padding: 12px 14px; font-family: system-ui, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(51, 65, 85, 0.7); padding-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.5rem;">${country.flag}</span>
              <div>
                <strong style="color: #ffffff; font-size: 0.95rem; display: block; line-height: 1.2;">${country.name}</strong>
                <span style="color: #94a3b8; font-size: 0.72rem;">${country.region} · ${country.id}</span>
              </div>
            </div>
            <span style="font-size: 0.68rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: rgba(30, 41, 59, 0.8); color: ${color};">
              ${country.conflictStatus}
            </span>
          </div>
          
          <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.72rem;">
            <div style="background: rgba(30, 41, 59, 0.8); padding: 6px 8px; border-radius: 6px;">
              <span style="color: #94a3b8; display: block; font-size: 0.65rem;">Conflict Severity</span>
              <strong style="color: #ef4444; font-size: 0.85rem;">${country.currentConflictIntensity}/100</strong>
            </div>
            <div style="background: rgba(30, 41, 59, 0.8); padding: 6px 8px; border-radius: 6px;">
              <span style="color: #94a3b8; display: block; font-size: 0.65rem;">Human Capital (HCI+)</span>
              <strong style="color: #a78bfa; font-size: 0.85rem;">${country.currentHciPlus} <span style="font-size: 0.65rem; color: #94a3b8; font-weight: normal;">/ 325</span></strong>
            </div>
            <div style="background: rgba(30, 41, 59, 0.8); padding: 6px 8px; border-radius: 6px;">
              <span style="color: #94a3b8; display: block; font-size: 0.65rem;">GDP per Capita</span>
              <strong style="color: #10b981; font-size: 0.85rem;">$${country.currentGdpPerCapita.toLocaleString()}</strong>
            </div>
            <div style="background: rgba(30, 41, 59, 0.8); padding: 6px 8px; border-radius: 6px;">
              <span style="color: #94a3b8; display: block; font-size: 0.65rem;">Displaced</span>
              <strong style="color: #f59e0b; font-size: 0.85rem;">${(country.currentDisplaced / 1000).toFixed(1)}M</strong>
            </div>
          </div>

          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(51, 65, 85, 0.6); text-align: center;">
            <button id="btn-inspect-${country.id}" style="width: 100%; background: #f59e0b; color: #020617; font-weight: 600; padding: 7px 10px; border-radius: 6px; font-size: 0.75rem; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span>Open Graphs & Prediction Model</span> →
            </button>
          </div>
        </div>
      `;

      circle.bindPopup(popupHtml, {
        className: 'dark-leaflet-popup',
        closeButton: true,
        autoPan: true,
      });

      // Events
      circle.on('click', () => {
        onSelectCountry(country);
        map.flyTo([country.lat, country.lng], Math.max(map.getZoom(), 4.5), { duration: 0.8 });
      });

      circle.on('popupopen', () => {
        setTimeout(() => {
          const btn = document.getElementById(`btn-inspect-${country.id}`);
          if (btn) {
            btn.onclick = () => {
              onSelectCountry(country);
            };
          }
        }, 50);
      });

      circle.on('mouseover', () => {
        setHoveredCountry(country);
        circle.setStyle({
          weight: 3.5,
          color: '#FEF08A',
        });
      });

      circle.on('mouseout', () => {
        setHoveredCountry(null);
        circle.setStyle({
          weight: isSelected ? 3.5 : isLightMap ? 2.0 : 1.5,
          color: isSelected ? '#FFFFFF' : isLightMap ? '#0F172A' : '#0B0F17',
        });
      });

      circle.addTo(layerGroup);
    });
  }, [visibleCountries, activeMetric, selectedCountry, mapStyle]);

  // Map Controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleReset = () => {
    const view = regionViews[selectedRegion] || regionViews['All'];
    mapInstanceRef.current?.flyTo(view.center, view.zoom, { duration: 0.8 });
  };

  return (
    <div className="relative flex flex-col w-full h-[calc(100vh-4rem)] bg-[#070A0F] overflow-hidden">
      
      {/* Top Filter and Layer Control Bar */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0B0F17]/95 px-4 py-3 backdrop-blur-md">
        
        {/* Metric Layer Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-amber-400" />
            Layer:
          </span>
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
            <button
              onClick={() => setActiveMetric('conflict')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === 'conflict'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Conflict Severity
            </button>
            <button
              onClick={() => setActiveMetric('hdi')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === 'hdi'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Human Development (HDI)
            </button>
            <button
              onClick={() => setActiveMetric('hci')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === 'hci'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              HCI+
            </button>
            <button
              onClick={() => setActiveMetric('gdp')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === 'gdp'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GDP per Capita
            </button>
            <button
              onClick={() => setActiveMetric('displacement')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === 'displacement'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Displacement
            </button>
            <button
              onClick={() => setActiveMetric('military')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === 'military'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Military (% GDP)
            </button>
            <button
              onClick={() => setActiveMetric('foodInsecurity')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === 'foodInsecurity'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Food Insecurity
            </button>
            <button
              onClick={() => setActiveMetric('outOfSchool')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === 'outOfSchool'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Out-of-School
            </button>
            <button
              onClick={() => setActiveMetric('healthCoverage')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === 'healthCoverage'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Health Coverage
            </button>
          </div>
        </div>

        {/* Region & Political Basemap Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Region Quick Select */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="leaflet-region-select" className="text-xs text-slate-400">Region:</label>
            <select
              id="leaflet-region-select"
              value={selectedRegion}
              onChange={e => onSelectRegion(e.target.value as Region)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="All">All Continents (Global)</option>
              <option value="Middle East & North Africa">Middle East & North Africa</option>
              <option value="Sub-Saharan Africa">Sub-Saharan Africa</option>
              <option value="Eastern Europe & Eurasia">Eastern Europe & Eurasia</option>
              <option value="South & Southeast Asia">South & Southeast Asia</option>
              <option value="Latin America & Caribbean">Latin America & Caribbean</option>
              <option value="North America & Europe">North America & Europe</option>
            </select>
          </div>

          {/* Status Quick Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="All">All Statuses</option>
            <option value="Active War">Active War</option>
            <option value="Protracted Insurgency">Protracted Insurgency</option>
            <option value="Post-Conflict Recovery">Post-Conflict Recovery</option>
            <option value="Stable / Benchmark">Stable Benchmarks</option>
          </select>

          {/* Real-World GIS Basemap Style Switcher with Political First */}
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setMapStyle('political')}
              title="CartoDB Voyager Sovereign Political Boundaries and Labels"
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mapStyle === 'political'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flag className="h-3 w-3" />
              <span>Political Borders</span>
            </button>
            <button
              onClick={() => setMapStyle('natgeo')}
              title="National Geographic Classic World Political Map"
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mapStyle === 'natgeo'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="h-3 w-3" />
              <span>NatGeo Political</span>
            </button>
            <button
              onClick={() => setMapStyle('satellite')}
              title="High-resolution orbital satellite photography of Earth"
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mapStyle === 'satellite'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Satellite className="h-3 w-3" />
              <span>Real Satellite</span>
            </button>
            <button
              onClick={() => setMapStyle('dark')}
              title="Tactical dark night cartography"
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mapStyle === 'dark'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Dark Matter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Leaflet Map Viewport Container */}
      <div className="relative flex-1 w-full h-full">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Zoom & Map Controls */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-center gap-1 rounded-xl border border-slate-800 bg-[#0B0F17]/90 p-1.5 shadow-2xl backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleReset}
            title="Reset Map Bounds"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Dynamic Map Legend & Instructions */}
        <div className="absolute bottom-6 left-6 z-20 rounded-xl border border-slate-800 bg-[#0B0F17]/95 p-3.5 shadow-2xl backdrop-blur-md text-xs max-w-sm sm:max-w-md">
          <div className="flex items-center justify-between gap-2 font-semibold text-slate-200 mb-2">
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-amber-400" />
              {activeMetric === 'conflict' && 'Conflict Severity Scale (UCDP/ACLED)'}
              {activeMetric === 'hdi' && 'Human Development Index (UNDP 0-1)'}
              {activeMetric === 'hci' && 'Human Capital Index Plus (World Bank Data360 WB_HCIP 0-325)'}
              {activeMetric === 'gdp' && 'Real GDP per Capita (USD Constant)'}
              {activeMetric === 'displacement' && 'Forced Displaced Persons (UNHCR)'}
              {activeMetric === 'military' && 'Military Expenditure (% of GDP - SIPRI / WB)'}
              {activeMetric === 'foodInsecurity' && 'Prevalence of Undernourishment (% Pop - FAO / WFP)'}
              {activeMetric === 'outOfSchool' && 'Out-of-School Children Rate (% School-Age - UNESCO)'}
              {activeMetric === 'healthCoverage' && 'Essential Health Service Coverage Index (0-100 - WHO)'}
            </span>
            <span className="text-[10px] text-amber-400/90 font-mono">Click country to inspect</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums text-slate-400">
            {activeMetric === 'conflict' && (
              <>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &lt;15 Minimal</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> 15-35 Low</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 35-60 Moderate</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &gt;75 Severe War</span>
              </>
            )}

            {activeMetric === 'hci' && (
              <>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &lt;100 Conflict Deficit</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 100-160 Developing</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> 160-210 High</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &gt;210 Frontier Potential (/325)</span>
              </>
            )}

            {activeMetric === 'hdi' && (
              <>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &lt;0.55 Low</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 0.55-0.70 Medium</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> 0.70-0.85 High</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &gt;0.85 Very High</span>
              </>
            )}

            {activeMetric === 'gdp' && (
              <>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &lt;$1.5k</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> $1.5k-$5k</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> $5k-$20k</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &gt;$40k High</span>
              </>
            )}

            {activeMetric === 'displacement' && (
              <>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> &lt;100k</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 500k+</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-600" /> 2M+</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> 5M+ Acute Crisis</span>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
