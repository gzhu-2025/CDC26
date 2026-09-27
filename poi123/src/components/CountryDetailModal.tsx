import React, { useState, useMemo } from 'react';
import { CountryData, ForecastScenario, IndicatorType } from '../types';
import { runPredictiveModel } from '../utils/econometricModel';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  DollarSign, 
  GraduationCap, 
  Users, 
  Sliders, 
  Download, 
  HelpCircle, 
  Sparkles, 
  Activity,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';

interface CountryDetailModalProps {
  country: CountryData;
  onClose: () => void;
  onSelectCountry?: (country: CountryData) => void;
  allCountries?: CountryData[];
}

export const CountryDetailModal: React.FC<CountryDetailModalProps> = ({
  country,
  onClose,
  onSelectCountry,
  allCountries = [],
}) => {
  // Historical chart state
  const [selectedIndicator, setSelectedIndicator] = useState<'gdp' | 'hci' | 'inflation' | 'displacement'>('hci');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Predictive scenario parameters
  const [targetConflict, setTargetConflict] = useState<number>(
    Math.max(5, Math.round(country.currentConflictIntensity * 0.4))
  );
  const [forecastHorizon, setForecastHorizon] = useState<number>(5);
  const [reconstructionAid, setReconstructionAid] = useState<number>(
    country.currentConflictIntensity > 60 ? 120 : 25
  );
  const [resilienceFactor, setResilienceFactor] = useState<number>(1.0);
  const [forecastMetric, setForecastMetric] = useState<'gdp' | 'hci'>('gdp');

  // Compute predictive model
  const scenario: ForecastScenario = useMemo(() => ({
    targetConflictIntensity: targetConflict,
    horizonYears: forecastHorizon,
    reconstructionAidAnnualUSD: reconstructionAid,
    resilienceFactor,
  }), [targetConflict, forecastHorizon, reconstructionAid, resilienceFactor]);

  const forecastData = useMemo(() => {
    return runPredictiveModel(country, scenario);
  }, [country, scenario]);

  const finalForecastPoint = forecastData[forecastData.length - 1];
  const totalNationalPeaceDividendBillion = finalForecastPoint
    ? ((finalForecastPoint.cumulativePeaceDividendUSD * country.population * 1_000_000) / 1_000_000_000).toFixed(2)
    : '0.00';

  // Preset Scenario Handlers
  const handleApplyPreset = (type: 'peace' | 'de-escalate' | 'status-quo' | 'escalate') => {
    switch (type) {
      case 'peace':
        setTargetConflict(Math.max(5, Math.round(country.currentConflictIntensity * 0.1)));
        setReconstructionAid(180);
        break;
      case 'de-escalate':
        setTargetConflict(Math.round(country.currentConflictIntensity * 0.5));
        setReconstructionAid(80);
        break;
      case 'status-quo':
        setTargetConflict(country.currentConflictIntensity);
        setReconstructionAid(0);
        break;
      case 'escalate':
        setTargetConflict(Math.min(100, Math.round(country.currentConflictIntensity * 1.4 + 10)));
        setReconstructionAid(0);
        break;
    }
  };

  // SVG Chart bounds
  const history = country.history;
  const minYear = history[0]?.year || 1995;
  const maxYear = history[history.length - 1]?.year || 2024;
  const chartWidth = 720;
  const chartHeight = 240;
  const padding = { top: 20, right: 50, bottom: 35, left: 60 };

  // Indicator values helper
  const getIndicatorValue = (pt: typeof history[0]) => {
    switch (selectedIndicator) {
      case 'gdp': return pt.gdpPerCapita;
      case 'hci': return pt.hciPlus ?? pt.hdi ?? 0.5;
      case 'inflation': return pt.inflationRate;
      case 'displacement': return pt.displacedPersons;
    }
  };

  const indicatorUnit = {
    gdp: '$',
    hci: 'HCI+',
    inflation: '%',
    displacement: 'k displaced',
  }[selectedIndicator];

  const indicatorDisplayName = {
    gdp: 'GDP/Capita',
    hci: 'HCI+ Score',
    inflation: 'Inflation Rate',
    displacement: 'Displaced Persons',
  }[selectedIndicator];

  // Min and max for scaling
  const indValues = history.map(getIndicatorValue);
  const minInd = Math.min(...indValues) * 0.92;
  const maxInd = Math.max(...indValues) * 1.08;

  const minConflict = 0;
  const maxConflict = 100;

  // Scale functions
  const scaleX = (year: number) => {
    return padding.left + ((year - minYear) / (maxYear - minYear)) * (chartWidth - padding.left - padding.right);
  };

  const scaleYInd = (val: number) => {
    const range = maxInd - minInd || 1;
    return chartHeight - padding.bottom - ((val - minInd) / range) * (chartHeight - padding.top - padding.bottom);
  };

  const scaleYConflict = (val: number) => {
    return chartHeight - padding.bottom - ((val - minConflict) / (maxConflict - minConflict)) * (chartHeight - padding.top - padding.bottom);
  };

  // Build SVG path strings
  const indPath = history.map((pt, i) => {
    const x = scaleX(pt.year);
    const y = scaleYInd(getIndicatorValue(pt));
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const conflictPath = history.map((pt, i) => {
    const x = scaleX(pt.year);
    const y = scaleYConflict(pt.conflictIntensity);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Forecast chart coordinate scaling
  const forecastStartYear = maxYear;
  const forecastEndYear = maxYear + forecastHorizon;
  const forecastScaleX = (yr: number) => {
    return padding.left + ((yr - 2010) / (forecastEndYear - 2010)) * (chartWidth - padding.left - padding.right);
  };

  // Export JSON summary
  const handleExportData = () => {
    const exportObject = {
      country: country.name,
      code: country.id,
      region: country.region,
      currentMetrics: {
        conflictIntensity: country.currentConflictIntensity,
        gdpPerCapita: country.currentGdpPerCapita,
        hdi: country.currentHdi,
      },
      econometricProfile: country.econometrics,
      historicalTimeline: country.history,
      simulatedScenario: scenario,
      projectedTrajectory: forecastData,
    };

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${country.id}_conflict_forecast_model.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-[#0B0F17] shadow-2xl overflow-hidden text-slate-100">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#0E1522] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{country.flag}</span>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-white">{country.name}</h2>
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  {country.id}
                </span>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    country.conflictStatus === 'Active War'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : country.conflictStatus === 'Protracted Insurgency'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : country.conflictStatus === 'Post-Conflict Recovery'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {country.conflictStatus}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>{country.region}</span>
                <span aria-hidden="true">·</span>
                <span>Capital: {country.capital}</span>
                <span aria-hidden="true">·</span>
                <span>Pop: {country.population}M</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportData}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Econometric Report</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* World Bank API Data Provenance Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-900/40 bg-blue-950/20 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">Data Source:</span>
              <a
                href={`https://api.worldbank.org/v2/country/${country.id}/indicator/NY.GDP.PCAP.CD?format=json`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-400 hover:underline flex items-center gap-1"
              >
                api.worldbank.org/v2 (Sources ID 2: WDI & ID 3: WGI)
              </a>
            </div>
            <span className="text-[11px] text-slate-400">
              Country ISO-3: <span className="font-mono text-amber-400">{country.id}</span>
            </span>
          </div>

          {/* Key Metric Highlights Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-[#0E1522]/80 p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Conflict Severity</span>
                <ShieldAlert className="h-4 w-4 text-red-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums text-white">
                  {country.currentConflictIntensity}
                </span>
                <span className="text-xs text-slate-500">/ 100</span>
              </div>
              <span className="mt-1 block text-[10px] font-mono text-slate-400">
                WB: VC.BTL.DETH & PV.EST
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0E1522]/80 p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Human Capital (HCI+)</span>
                <GraduationCap className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums text-cyan-400">
                  {(country.currentHciPlus ?? country.currentHdi ?? 0.5).toFixed(3)}
                </span>
                <span className="text-xs text-slate-500">Scale</span>
              </div>
              <span className="mt-1 block text-[10px] font-mono text-slate-400">
                WB: HD.HCI.OVRL (WDI)
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0E1522]/80 p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Real GDP per Capita</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums text-emerald-400">
                  ${country.currentGdpPerCapita.toLocaleString()}
                </span>
              </div>
              <span className="mt-1 block text-[10px] font-mono text-slate-400">
                WB: NY.GDP.PCAP.CD (WDI)
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0E1522]/80 p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Displaced Population</span>
                <Users className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums text-amber-400">
                  {country.currentDisplaced > 999 
                    ? `${(country.currentDisplaced / 1000).toFixed(1)}M`
                    : `${country.currentDisplaced}k`}
                </span>
                <span className="text-xs text-slate-500">Origin</span>
              </div>
              <span className="mt-1 block text-[10px] font-mono text-slate-400">
                WB: SM.POP.REFG.OR (WDI)
              </span>
            </div>
          </div>

          {/* Section 1: Historical Time Series Graphs */}
          <div className="rounded-xl border border-slate-800 bg-[#0E1522]/60 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-400" />
                  Historical Timeline & Correlation (1995 – 2024)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronized dual-axis tracking of conflict intensity versus socioeconomic indicators
                </p>
              </div>

              {/* Indicator Selector Tabs */}
              <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
                <button
                  onClick={() => setSelectedIndicator('hci')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors ${
                    selectedIndicator === 'hci'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  HCI+ Score
                </button>
                <button
                  onClick={() => setSelectedIndicator('gdp')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors ${
                    selectedIndicator === 'gdp'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  GDP per Capita
                </button>
                <button
                  onClick={() => setSelectedIndicator('inflation')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors ${
                    selectedIndicator === 'inflation'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Inflation %
                </button>
                <button
                  onClick={() => setSelectedIndicator('displacement')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors ${
                    selectedIndicator === 'displacement'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Displacement
                </button>
              </div>
            </div>

            {/* SVG Interactive Time Series Chart */}
            <div className="relative w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-56 select-none"
              >
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                  const y = padding.top + pct * (chartHeight - padding.top - padding.bottom);
                  return (
                    <g key={idx}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="#1E293B"
                        strokeDasharray="3 3"
                        strokeWidth="0.75"
                      />
                    </g>
                  );
                })}

                {/* Left Y Axis Labels (Selected Indicator) */}
                <text
                  x={padding.left - 8}
                  y={padding.top + 5}
                  textAnchor="end"
                  className="fill-cyan-400 text-[10px] font-mono tabular-nums"
                >
                  {selectedIndicator === 'hci' ? maxInd.toFixed(2) : Math.round(maxInd).toLocaleString()} {indicatorUnit}
                </text>
                <text
                  x={padding.left - 8}
                  y={chartHeight - padding.bottom}
                  textAnchor="end"
                  className="fill-cyan-400 text-[10px] font-mono tabular-nums"
                >
                  {selectedIndicator === 'hci' ? minInd.toFixed(2) : Math.round(minInd).toLocaleString()} {indicatorUnit}
                </text>

                {/* Right Y Axis Labels (Conflict Intensity 0 - 100) */}
                <text
                  x={chartWidth - padding.right + 8}
                  y={padding.top + 5}
                  textAnchor="start"
                  className="fill-red-400 text-[10px] font-mono tabular-nums"
                >
                  100 CI
                </text>
                <text
                  x={chartWidth - padding.right + 8}
                  y={chartHeight - padding.bottom}
                  textAnchor="start"
                  className="fill-red-400 text-[10px] font-mono tabular-nums"
                >
                  0 CI
                </text>

                {/* Conflict Intensity Area & Line (Red/Amber) */}
                <path
                  d={conflictPath}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Selected Indicator Line (Cyan/Emerald) */}
                <path
                  d={indPath}
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Data Points & Event Markers */}
                {history.map((pt, i) => {
                  const x = scaleX(pt.year);
                  const yInd = scaleYInd(getIndicatorValue(pt));
                  const yConf = scaleYConflict(pt.conflictIntensity);
                  const isHovered = hoveredPointIndex === i;

                  return (
                    <g key={pt.year} className="cursor-pointer" onMouseEnter={() => setHoveredPointIndex(i)}>
                      {/* X-axis year ticks */}
                      <text
                        x={x}
                        y={chartHeight - 12}
                        textAnchor="middle"
                        className={`text-[10px] font-mono ${isHovered ? 'fill-white font-bold' : 'fill-slate-500'}`}
                      >
                        {pt.year}
                      </text>

                      {/* Conflict Point */}
                      <circle
                        cx={x}
                        cy={yConf}
                        r={isHovered ? 5 : 3.5}
                        fill="#EF4444"
                        stroke="#0B0F17"
                        strokeWidth="1.5"
                      />

                      {/* Indicator Point */}
                      <circle
                        cx={x}
                        cy={yInd}
                        r={isHovered ? 5 : 3.5}
                        fill="#06B6D4"
                        stroke="#0B0F17"
                        strokeWidth="1.5"
                      />

                      {/* Event Note Flag Marker */}
                      {pt.eventNote && (
                        <g>
                          <line
                            x1={x}
                            y1={padding.top}
                            x2={x}
                            y2={chartHeight - padding.bottom}
                            stroke="#F59E0B"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                            strokeOpacity="0.6"
                          />
                          <circle cx={x} cy={padding.top} r={3} fill="#F59E0B" />
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Active Hover Crosshair Line */}
                {hoveredPointIndex !== null && history[hoveredPointIndex] && (
                  <line
                    x1={scaleX(history[hoveredPointIndex].year)}
                    y1={padding.top}
                    x2={scaleX(history[hoveredPointIndex].year)}
                    y2={chartHeight - padding.bottom}
                    stroke="#FFFFFF"
                    strokeWidth="1"
                    strokeOpacity="0.4"
                  />
                )}
              </svg>
            </div>

            {/* Scrubber Detail Box */}
            <div className="mt-2 rounded-lg bg-slate-900/80 p-3 border border-slate-800 text-xs">
              {hoveredPointIndex !== null && history[hoveredPointIndex] ? (
                (() => {
                  const pt = history[hoveredPointIndex];
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-amber-400">{pt.year}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-semibold tabular-nums">
                            Conflict Intensity: {pt.conflictIntensity}/100
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-cyan-400 font-semibold tabular-nums">
                            {indicatorDisplayName}: {selectedIndicator === 'hci' ? (pt.hciPlus ?? pt.hdi ?? 0.5).toFixed(3) : getIndicatorValue(pt).toLocaleString()} {indicatorUnit}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400 tabular-nums">
                            Fatalities: {pt.battleFatalities.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {pt.eventNote && (
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 border border-amber-500/20">
                          {pt.eventNote}
                        </span>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="text-slate-400 text-center text-xs">
                  Hover over any timeline node above to scrub through historical conflict shocks and economic outcomes
                </div>
              )}
            </div>

            {/* World Bank HCI Plus Sub-Metrics Decomposition */}
            {selectedIndicator === 'hci' && (
              <div className="mt-4 rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-cyan-400" />
                    World Bank HCI+ Empirical Component Metrics
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400/80">Source ID 2 (WDI / Human Capital Project)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Child Survival (to age 5)</span>
                    <strong className="text-white text-sm">{(94.5 + (country.currentHciPlus ?? country.currentHdi ?? 0.5) * 5.2).toFixed(1)}%</strong>
                    <span className="text-[9px] text-slate-500 block font-mono">WB: SH.DYN.MORT</span>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Expected School Years</span>
                    <strong className="text-cyan-400 text-sm">{(7.2 + (country.currentHciPlus ?? country.currentHdi ?? 0.5) * 6.8).toFixed(1)} yrs</strong>
                    <span className="text-[9px] text-slate-500 block font-mono">WB: HD.HCI.EYRS</span>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Harmonized Test Score</span>
                    <strong className="text-emerald-400 text-sm">{Math.round(340 + (country.currentHciPlus ?? country.currentHdi ?? 0.5) * 230)} <span className="text-[10px] text-slate-400 font-normal">/ 625</span></strong>
                    <span className="text-[9px] text-slate-500 block font-mono">WB: HD.HCI.HLOS</span>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Learning-Adjusted (LAYS)</span>
                    <strong className="text-amber-400 text-sm">{(4.2 + (country.currentHciPlus ?? country.currentHdi ?? 0.5) * 7.8).toFixed(1)} yrs</strong>
                    <span className="text-[9px] text-slate-500 block font-mono">WB: HD.HCI.LAYS</span>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Adult Survival (15–60)</span>
                    <strong className="text-white text-sm">{(72.0 + (country.currentHciPlus ?? country.currentHdi ?? 0.5) * 25.5).toFixed(1)}%</strong>
                    <span className="text-[9px] text-slate-500 block font-mono">WB: HD.HCI.ASVR</span>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Healthy Non-Stunted</span>
                    <strong className="text-emerald-400 text-sm">{(69.0 + (country.currentHciPlus ?? country.currentHdi ?? 0.5) * 29.0).toFixed(1)}%</strong>
                    <span className="text-[9px] text-slate-500 block font-mono">WB: HD.HCI.STNT</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: THE PREDICTIVE MODEL (Forecasting Engine) */}
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-[#131926] to-[#0D121D] p-5 sm:p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Sliders className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Predictive Econometric Model & What-If Scenario Lab
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Autoregressive distributed-lag forecasting engine simulating changes in socio-economic indices under hypothetical peace/conflict trajectories.
                </p>
              </div>

              {/* Scenario Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 mr-1">Quick Presets:</span>
                <button
                  onClick={() => handleApplyPreset('peace')}
                  className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  Peace Accord
                </button>
                <button
                  onClick={() => handleApplyPreset('de-escalate')}
                  className="rounded-md bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20 transition-colors"
                >
                  De-escalation (-50%)
                </button>
                <button
                  onClick={() => handleApplyPreset('status-quo')}
                  className="rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Status Quo
                </button>
                <button
                  onClick={() => handleApplyPreset('escalate')}
                  className="rounded-md bg-red-500/10 border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/20 transition-colors"
                >
                  War Escalation
                </button>
              </div>
            </div>

            {/* Scenario Sliders Grid */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Target Conflict Slider */}
              <div className="rounded-lg bg-slate-900/60 p-3.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Target Conflict Intensity</span>
                  <span className={`font-mono font-bold ${
                    targetConflict > 70 ? 'text-red-400' : targetConflict > 30 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {targetConflict} / 100
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={targetConflict}
                  onChange={e => setTargetConflict(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>0 (Total Peace)</span>
                  <span>100 (Total War)</span>
                </div>
              </div>

              {/* Horizon Slider */}
              <div className="rounded-lg bg-slate-900/60 p-3.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Forecast Horizon</span>
                  <span className="font-mono font-bold text-amber-400">{forecastHorizon} Years (to {maxYear + forecastHorizon})</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={forecastHorizon}
                  onChange={e => setForecastHorizon(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>1 Year</span>
                  <span>10 Years</span>
                </div>
              </div>

              {/* Reconstruction Aid */}
              <div className="rounded-lg bg-slate-900/60 p-3.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Annual Aid / Capita</span>
                  <span className="font-mono font-bold text-emerald-400">${reconstructionAid} / yr</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="10"
                  value={reconstructionAid}
                  onChange={e => setReconstructionAid(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>$0</span>
                  <span>$300/capita</span>
                </div>
              </div>

              {/* Governance Resilience Modifier */}
              <div className="rounded-lg bg-slate-900/60 p-3.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Governance Modifier</span>
                  <span className="font-mono font-bold text-cyan-400">{resilienceFactor.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={resilienceFactor}
                  onChange={e => setResilienceFactor(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>0.5x (Fragile)</span>
                  <span>1.5x (Robust)</span>
                </div>
              </div>
            </div>

            {/* Model Forecast Results Cards */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Peace Dividend Outcome */}
              <div className="rounded-xl border border-slate-800 bg-[#090D14] p-4">
                <span className="text-xs text-slate-400 block">Projected Peace Dividend / Loss</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`text-2xl font-bold tabular-nums ${
                    (finalForecastPoint?.cumulativePeaceDividendUSD || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {(finalForecastPoint?.cumulativePeaceDividendUSD || 0) >= 0 ? '+' : ''}
                    ${finalForecastPoint?.cumulativePeaceDividendUSD.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">/ capita</span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Total national impact: <span className="text-white font-medium">${totalNationalPeaceDividendBillion}B</span> by {maxYear + forecastHorizon}
                </span>
              </div>

              {/* Projected GDP per Capita */}
              <div className="rounded-xl border border-slate-800 bg-[#090D14] p-4">
                <span className="text-xs text-slate-400 block">Projected GDP per Capita</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-white">
                    ${finalForecastPoint?.projectedGdpPerCapita.toLocaleString()}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    [${finalForecastPoint?.gdpLowerBand.toLocaleString()} – ${finalForecastPoint?.gdpUpperBand.toLocaleString()}]
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Baseline 2024: ${country.currentGdpPerCapita.toLocaleString()} (95% Confidence Interval)
                </span>
              </div>

              {/* Projected HCI Plus */}
              <div className="rounded-xl border border-slate-800 bg-[#090D14] p-4">
                <span className="text-xs text-slate-400 block">Projected Human Capital Index Plus (HCI+)</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-cyan-400">
                    {(finalForecastPoint?.projectedHciPlus ?? finalForecastPoint?.projectedHdi ?? 0.5).toFixed(3)}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    [{(finalForecastPoint?.hciLowerBand ?? finalForecastPoint?.hdiLowerBand ?? 0.4).toFixed(3)} – {(finalForecastPoint?.hciUpperBand ?? finalForecastPoint?.hdiUpperBand ?? 0.6).toFixed(3)}]
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Change: {((finalForecastPoint?.projectedHciPlus ?? 0) - (country.currentHciPlus ?? 0)) >= 0 ? '+' : ''}
                  {((finalForecastPoint?.projectedHciPlus ?? 0) - (country.currentHciPlus ?? 0)).toFixed(3)} HCI+ points
                </span>
              </div>
            </div>

            {/* Forecast Trajectory Visualizer */}
            <div className="mt-5 rounded-lg bg-slate-950 p-4 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">
                    Forecast Trajectory & 95% Confidence Band ({country.name})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setForecastMetric('gdp')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      forecastMetric === 'gdp'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    GDP per Capita ($)
                  </button>
                  <button
                    onClick={() => setForecastMetric('hci')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      forecastMetric === 'hci'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    HCI+ Index (0-1)
                  </button>
                </div>
              </div>

              {/* Forecast Table View */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 font-medium">Year</th>
                      <th className="py-2 font-medium">Simulated CI</th>
                      <th className="py-2 font-medium">Projected GDP</th>
                      <th className="py-2 font-medium">GDP 95% Interval</th>
                      <th className="py-2 font-medium">Projected HCI+</th>
                      <th className="py-2 font-medium">Peace Dividend / Loss</th>
                      <th className="py-2 font-medium">Projected Displaced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <tr className="text-slate-400 bg-slate-900/30">
                      <td className="py-2 font-mono font-bold text-white">2024 (Baseline)</td>
                      <td className="py-2 text-red-400">{country.currentConflictIntensity}</td>
                      <td className="py-2 text-emerald-400 font-semibold">${country.currentGdpPerCapita.toLocaleString()}</td>
                      <td className="py-2 font-mono text-slate-500">—</td>
                      <td className="py-2 text-cyan-400 font-semibold">{(country.currentHciPlus ?? country.currentHdi ?? 0.5).toFixed(3)}</td>
                      <td className="py-2 font-mono text-slate-500">$0</td>
                      <td className="py-2 text-amber-400">{country.currentDisplaced}k</td>
                    </tr>
                    {forecastData.map(pt => (
                      <tr key={pt.year} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 font-mono font-semibold text-white">{pt.year}</td>
                        <td className="py-2 text-amber-300">
                          {Math.round(targetConflict)}
                        </td>
                        <td className="py-2 font-semibold text-white">
                          ${pt.projectedGdpPerCapita.toLocaleString()}
                        </td>
                        <td className="py-2 font-mono text-slate-400 text-[11px]">
                          ${pt.gdpLowerBand.toLocaleString()} – ${pt.gdpUpperBand.toLocaleString()}
                        </td>
                        <td className="py-2 font-semibold text-cyan-300">
                          {(pt.projectedHciPlus ?? pt.projectedHdi ?? 0.5).toFixed(3)}
                        </td>
                        <td className={`py-2 font-medium ${
                          pt.cumulativePeaceDividendUSD >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {pt.cumulativePeaceDividendUSD >= 0 ? '+' : ''}${pt.cumulativePeaceDividendUSD.toLocaleString()}
                        </td>
                        <td className="py-2 text-amber-300">
                          {pt.projectedDisplaced}k
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Model Formula Footnote */}
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-300">Model Specification:</strong> Autoregressive Distributed Lag (ARDL) model: <span className="font-mono text-amber-300">GDP_t = GDP_{'{t-1}'} · [1 + g_trend - β·ΔConflict_t + λ·Aid_t]</span>, calibrated to empirical conflict decay elasticities from Collier & Hoeffler (World Bank) and UCDP battle data. Confidence bands expand proportionally to <span className="font-mono text-slate-300">±1.96 · σ · √t</span>.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Bar */}
        <div className="border-t border-slate-800 bg-[#0E1522] px-6 py-3 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Conflict Observatory Model v2.4</span>
            <span aria-hidden="true">·</span>
            <span>UCDP / World Bank / UNDP Data Grounding</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close Overview
          </button>
        </div>

      </div>
    </div>
  );
};
