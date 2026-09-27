import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CountryData, IndicatorType, Region } from '../types';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Search, 
  ShieldAlert, 
  Layers, 
  Info, 
  MapPin, 
  Globe, 
  Sliders, 
  TrendingUp, 
  X,
  Compass
} from 'lucide-react';

interface WorldMapProps {
  countries: CountryData[];
  selectedCountry: CountryData | null;
  onSelectCountry: (country: CountryData) => void;
  selectedRegion: Region;
  onSelectRegion: (region: Region) => void;
  activeMetric: IndicatorType;
  setActiveMetric: (metric: IndicatorType) => void;
}

export const WorldMap: React.FC<WorldMapProps> = ({
  countries,
  selectedCountry,
  onSelectCountry,
  selectedRegion,
  onSelectRegion,
  activeMetric,
  setActiveMetric,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredCountry, setHoveredCountry] = useState<CountryData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [mapSearch, setMapSearch] = useState('');
  
  // Drag-to-pan state
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  // Region pan & zoom presets for SVG 1000x550
  const regionSVGViews: Record<Region, { zoom: number; pan: { x: number; y: number } }> = {
    'All': { zoom: 1, pan: { x: 0, y: 0 } },
    'Middle East & North Africa': { zoom: 2.3, pan: { x: -280, y: -80 } },
    'Sub-Saharan Africa': { zoom: 1.8, pan: { x: -240, y: -160 } },
    'Eastern Europe & Eurasia': { zoom: 2.1, pan: { x: -280, y: -20 } },
    'South & Southeast Asia': { zoom: 2.0, pan: { x: -440, y: -100 } },
    'Latin America & Caribbean': { zoom: 1.9, pan: { x: 50, y: -150 } },
    'North America & Europe': { zoom: 1.6, pan: { x: -100, y: 0 } },
  };

  // Auto-focus on region changes
  useEffect(() => {
    const view = regionSVGViews[selectedRegion];
    if (view) {
      setZoom(view.zoom);
      setPan(view.pan);
    }
  }, [selectedRegion]);

  // Filter countries by region, status, and local search
  const visibleCountries = useMemo(() => {
    return countries.filter(c => {
      const matchRegion = selectedRegion === 'All' || c.region === selectedRegion;
      const matchStatus = statusFilter === 'All' || c.conflictStatus === statusFilter;
      const matchSearch = !mapSearch.trim() || 
        c.name.toLowerCase().includes(mapSearch.toLowerCase()) || 
        c.id.toLowerCase().includes(mapSearch.toLowerCase());
      return matchRegion && matchStatus && matchSearch;
    });
  }, [countries, selectedRegion, statusFilter, mapSearch]);

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
        if (val >= 10.0) return '#EF4444'; // Extreme militarization / war mobilization
        if (val >= 4.0) return '#F97316'; // High defense burden
        if (val >= 2.0) return '#F59E0B'; // Moderate
        return '#10B981'; // Low (<2% GDP)
      }
      case 'foodInsecurity': {
        const val = country.currentUndernourished;
        if (val >= 35.0) return '#DC2626'; // Severe hunger crisis / famine risk
        if (val >= 20.0) return '#EA580C'; // High acute food insecurity
        if (val >= 10.0) return '#F59E0B'; // Moderate
        return '#10B981'; // Low undernourishment (<10%)
      }
      case 'outOfSchool': {
        const val = country.currentOutOfSchool;
        if (val >= 35.0) return '#DC2626'; // Catastrophic education disruption
        if (val >= 20.0) return '#EA580C'; // High out-of-school rate
        if (val >= 10.0) return '#F59E0B'; // Moderate
        return '#10B981'; // Low out-of-school (<10%)
      }
      case 'healthCoverage': {
        const val = country.currentHealthCoverage;
        if (val >= 80) return '#10B981'; // High UHC service coverage
        if (val >= 65) return '#06B6D4'; // Moderate-High
        if (val >= 45) return '#F59E0B'; // Compromised
        return '#EF4444'; // Critical collapse (<45)
      }
      default:
        return '#3B82F6';
    }
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.35, 4.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.35, 0.8));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onSelectRegion('All');
  };

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (isDragging.current) {
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      setPan({
        x: panStart.current.x + dx,
        y: panStart.current.y + dy,
      });
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="relative flex flex-col w-full h-[calc(100vh-4rem)] bg-[#070A0F] overflow-hidden select-none">
      
      {/* Top Filter and Layer Bar */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0B0F17]/95 px-4 py-3 backdrop-blur-md">
        
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

        {/* Search, Region & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick filter input on the map */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter country..."
              value={mapSearch}
              onChange={e => setMapSearch(e.target.value)}
              className="w-36 sm:w-44 rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {mapSearch && (
              <button onClick={() => setMapSearch('')} className="absolute right-2 top-2 text-slate-500 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Region Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="region-select" className="text-xs text-slate-400">Region:</label>
            <select
              id="region-select"
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

          {/* Global Count Tag */}
          <span className="hidden xl:inline text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
            {visibleCountries.length} / {countries.length} Nations
          </span>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div
        className="relative flex-1 w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          viewBox="0 0 1000 550"
          className="w-full h-full object-contain transition-transform duration-100 ease-out"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <defs>
            {/* Map Ocean Gradient */}
            <radialGradient id="oceanGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0D1522" />
              <stop offset="100%" stopColor="#05080D" />
            </radialGradient>

            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>

            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Ocean Backdrop with Coordinate Grid */}
          <rect width="1000" height="550" fill="url(#oceanGlow)" />
          <rect width="1000" height="550" fill="url(#gridPattern)" />

          {/* Realistic High-Fidelity World Continents Landmass Contours */}
          <g className="opacity-60" fill="#152233" stroke="#22374E" strokeWidth="0.85">
            {/* North America, Greenland, Arctic */}
            <path d="M 60 90 L 85 75 L 115 65 L 150 60 L 195 55 L 240 60 L 255 70 L 270 85 L 250 100 L 225 95 L 210 110 L 235 125 L 250 145 L 235 160 L 220 185 L 205 195 L 200 220 L 180 235 L 170 205 L 160 175 L 140 160 L 120 165 L 105 140 L 80 125 L 60 110 Z" />
            <path d="M 245 45 L 285 35 L 325 45 L 340 75 L 320 105 L 285 115 L 255 95 L 240 70 Z" /> {/* Greenland */}
            
            {/* Central America & Caribbean */}
            <path d="M 180 235 L 195 245 L 220 265 L 245 285 L 260 295 L 250 305 L 230 290 L 205 270 L 185 250 Z" />
            <circle cx="280" cy="265" r="5" /> {/* Cuba */}
            <circle cx="305" cy="270" r="4" /> {/* Hispaniola */}

            {/* South America */}
            <path d="M 250 305 L 280 295 L 320 300 L 350 325 L 365 355 L 355 385 L 335 415 L 305 455 L 280 495 L 265 520 L 255 510 L 265 470 L 260 430 L 245 380 L 235 340 L 240 315 Z" />
            <circle cx="270" cy="530" r="3" /> {/* Tierra del Fuego */}

            {/* Europe & British Isles */}
            <path d="M 450 75 L 480 60 L 510 55 L 530 75 L 515 105 L 495 115 L 475 120 L 460 110 Z" /> {/* Scandinavia */}
            <path d="M 425 105 L 445 95 L 455 115 L 440 135 L 420 125 Z" /> {/* Great Britain */}
            <path d="M 410 115 L 420 110 L 425 125 L 415 130 Z" /> {/* Ireland */}
            <path d="M 445 130 L 475 125 L 510 120 L 535 135 L 555 145 L 540 170 L 515 175 L 495 190 L 470 185 L 450 170 L 435 155 Z" /> {/* Western & Central Europe */}
            <path d="M 440 165 L 465 160 L 460 190 L 430 195 Z" /> {/* Iberian Peninsula */}
            <path d="M 495 165 L 505 175 L 515 200 L 500 205 Z" /> {/* Italy */}
            <circle cx="495" cy="210" r="3" /> {/* Sicily */}
            <path d="M 525 175 L 545 180 L 540 210 L 525 200 Z" /> {/* Greece & Balkans */}

            {/* Africa */}
            <path d="M 445 195 L 490 190 L 545 200 L 575 220 L 590 250 L 635 285 L 630 325 L 585 385 L 555 440 L 525 460 L 495 440 L 475 390 L 455 330 L 435 280 L 430 230 Z" />
            <path d="M 615 365 L 635 370 L 625 425 L 605 410 Z" /> {/* Madagascar */}

            {/* Middle East & Arabian Peninsula */}
            <path d="M 565 210 L 610 215 L 640 240 L 635 295 L 595 290 L 575 250 Z" />

            {/* Eurasia / Russia / Northern Asia */}
            <path d="M 540 70 L 610 65 L 685 60 L 770 55 L 850 60 L 910 80 L 880 115 L 820 135 L 750 140 L 680 145 L 610 150 L 555 145 Z" />

            {/* South Asia (Indian Subcontinent) */}
            <path d="M 655 215 L 705 210 L 735 250 L 710 310 L 680 290 L 655 250 Z" />
            <circle cx="715" cy="325" r="3.5" /> {/* Sri Lanka */}

            {/* East Asia & China */}
            <path d="M 720 155 L 810 150 L 860 175 L 835 235 L 795 260 L 750 250 L 720 200 Z" />
            <path d="M 830 175 L 845 185 L 835 210 L 825 195 Z" /> {/* Korea */}
            <path d="M 855 160 L 875 175 L 865 225 L 845 215 Z" /> {/* Japan */}
            <circle cx="825" cy="265" r="3.5" /> {/* Taiwan */}

            {/* Southeast Asia & Maritime Archipelagos */}
            <path d="M 745 235 L 785 240 L 775 285 L 755 290 L 740 260 Z" /> {/* Indochina */}
            <path d="M 770 315 L 835 320 L 825 345 L 760 335 Z" /> {/* Sumatra / Java */}
            <path d="M 800 295 L 830 300 L 825 325 L 795 320 Z" /> {/* Borneo */}
            <path d="M 845 265 L 860 280 L 850 310 L 835 285 Z" /> {/* Philippines */}

            {/* Australia & New Zealand */}
            <path d="M 760 380 L 820 370 L 875 385 L 885 435 L 855 470 L 795 460 L 765 425 Z" /> {/* Australia */}
            <circle cx="830" cy="485" r="3" /> {/* Tasmania */}
            <path d="M 895 440 L 915 445 L 905 475 L 890 460 Z" /> {/* New Zealand North */}
            <path d="M 885 470 L 900 480 L 885 505 L 875 490 Z" /> {/* New Zealand South */}
          </g>

          {/* Interactive Country Nodes for Every Single Nation in the World */}
          {visibleCountries.map(country => {
            const isHovered = hoveredCountry?.id === country.id;
            const isSelected = selectedCountry?.id === country.id;
            const color = getMetricColor(country);
            
            // Dynamic node radius scaled to conflict intensity
            const baseRadius = Math.max(5, Math.min(18, Math.sqrt(country.currentConflictIntensity) * 1.6));
            const nodeRadius = isHovered || isSelected ? baseRadius * 1.3 : baseRadius;

            return (
              <g
                key={country.id}
                className="cursor-pointer transition-all duration-100"
                onClick={() => onSelectCountry(country)}
                onMouseEnter={() => setHoveredCountry(country)}
                onMouseLeave={() => setHoveredCountry(null)}
              >
                {/* Active War Pulse Ripple for High-Intensity Hotspots */}
                {country.currentConflictIntensity > 75 && (
                  <circle
                    cx={country.mapCoords.x}
                    cy={country.mapCoords.y}
                    r={baseRadius * 2.2}
                    fill={color}
                    fillOpacity="0.22"
                    className="animate-ping"
                    style={{ animationDuration: '2.5s' }}
                  />
                )}

                {/* Main Country Circle Marker */}
                <circle
                  cx={country.mapCoords.x}
                  cy={country.mapCoords.y}
                  r={nodeRadius}
                  fill={color}
                  fillOpacity={isHovered || isSelected ? 0.95 : 0.78}
                  stroke={isSelected ? '#FFFFFF' : isHovered ? '#FEF08A' : '#0B0F17'}
                  strokeWidth={isSelected ? 2.5 : 1.2}
                  filter="url(#glowEffect)"
                />

                {/* ISO Code Text (visible on hover, or high conflict, or when zoomed in) */}
                {(isHovered || isSelected || zoom > 1.6 || country.currentConflictIntensity > 60) && (
                  <text
                    x={country.mapCoords.x}
                    y={country.mapCoords.y + nodeRadius + 8}
                    textAnchor="middle"
                    className={`text-[8px] font-mono tracking-wider font-semibold pointer-events-none select-none ${
                      isHovered || isSelected ? 'fill-white font-bold text-[9px]' : 'fill-slate-400 opacity-80'
                    }`}
                  >
                    {country.id}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredCountry && (
          <div
            className="pointer-events-none absolute z-30 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md"
            style={{
              left: Math.min(mousePos.x + 16, window.innerWidth - 320),
              top: Math.max(mousePos.y - 120, 20),
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{hoveredCountry.flag}</span>
                <div>
                  <h4 className="font-semibold text-sm text-white leading-tight">{hoveredCountry.name}</h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>{hoveredCountry.region}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-500">{hoveredCountry.id}</span>
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  hoveredCountry.conflictStatus === 'Active War'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : hoveredCountry.conflictStatus === 'Protracted Insurgency'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : hoveredCountry.conflictStatus === 'Post-Conflict Recovery'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {hoveredCountry.conflictStatus}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-[10px] text-slate-400 block">Conflict Intensity</span>
                <span className="text-sm font-bold text-red-400 tabular-nums">
                  {hoveredCountry.currentConflictIntensity} / 100
                </span>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-[10px] text-slate-400 block">Human Capital (HCI+)</span>
                <span className="text-sm font-bold text-violet-400 tabular-nums">
                  {hoveredCountry.currentHciPlus} <span className="text-[10px] text-slate-400 font-normal">/ 325</span>
                </span>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-[10px] text-slate-400 block">GDP per Capita</span>
                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                  ${hoveredCountry.currentGdpPerCapita.toLocaleString()}
                </span>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-[10px] text-slate-400 block">Displaced Persons</span>
                <span className="text-sm font-bold text-amber-400 tabular-nums">
                  {(hoveredCountry.currentDisplaced / 1000).toFixed(1)}M
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-amber-400 font-medium">Click to inspect historical graphs & forecast</span>
              <span className="font-mono text-slate-500 text-[10px]">r = {hoveredCountry.econometrics.conflictGdpCorrelation}</span>
            </div>
          </div>
        )}

        {/* Floating Zoom Controls */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-center gap-1 rounded-xl border border-slate-800 bg-[#0B0F17]/90 p-1.5 shadow-xl backdrop-blur-md">
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
            onClick={handleResetZoom}
            title="Reset Map View"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Dynamic Map Legend */}
        <div className="absolute bottom-6 left-6 z-20 rounded-xl border border-slate-800 bg-[#0B0F17]/95 p-3.5 shadow-xl backdrop-blur-md text-xs max-w-sm sm:max-w-md">
          <div className="flex items-center justify-between gap-2 font-semibold text-slate-200 mb-2">
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-amber-400" />
              {activeMetric === 'conflict' && 'Conflict Severity Scale (UCDP/ACLED)'}
              {activeMetric === 'hdi' && 'Human Development Index (UNDP 0-1)'}
              {activeMetric === 'hci' && 'Human Capital Index Plus (World Bank Data360 WB_HCIP 0-325)'}
              {activeMetric === 'gdp' && 'Real GDP per Capita (USD)'}
              {activeMetric === 'displacement' && 'Forced Displaced Persons (UNHCR)'}
              {activeMetric === 'military' && 'Military Expenditure (% of GDP - SIPRI / WB)'}
              {activeMetric === 'foodInsecurity' && 'Prevalence of Undernourishment (% Pop - FAO / WFP)'}
              {activeMetric === 'outOfSchool' && 'Out-of-School Children Rate (% School-Age - UNESCO)'}
              {activeMetric === 'healthCoverage' && 'Essential Health Service Coverage Index (0-100 - WHO)'}
            </span>
            <span className="text-[10px] text-amber-400/90 font-mono">Click nation to view timeline</span>
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

            {activeMetric === 'military' && (
              <>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &lt;2.0% Low</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 2.0-4.0% Moderate</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> 4.0-10% High</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &gt;10% War Mobilization</span>
              </>
            )}

            {activeMetric === 'foodInsecurity' && (
              <>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &lt;10% Secure</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 10-20% Moderate</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> 20-35% Acute Deficit</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &gt;35% Severe Crisis / Famine</span>
              </>
            )}

            {activeMetric === 'outOfSchool' && (
              <>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &lt;10% Low</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 10-20% Moderate</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> 20-35% High</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &gt;35% Severe Disruption</span>
              </>
            )}

            {activeMetric === 'healthCoverage' && (
              <>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &gt;80 High Coverage</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> 65-80 Moderate</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 45-65 Compromised</span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &lt;45 Critical Breakdown</span>
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
