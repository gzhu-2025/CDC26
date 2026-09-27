import React, { useState } from 'react';
import { TopNav } from './components/TopNav';
import { LeafletMap } from './components/LeafletMap';
import { WorldMap } from './components/WorldMap';
import { CountryDetailModal } from './components/CountryDetailModal';
import { CrossCountryExplorer } from './components/CrossCountryExplorer';
import { ModelMethodologyModal } from './components/ModelMethodologyModal';
import { WorldBankSourcesModal } from './components/WorldBankSourcesModal';
import { COUNTRIES_DATA } from './data/countriesData';
import { CountryData, IndicatorType, Region } from './types';
import { Map, Layers } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'explorer' | 'methodology'>('map');
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region>('All');
  const [activeMetric, setActiveMetric] = useState<IndicatorType>('conflict');
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const [isWorldBankSourcesOpen, setIsWorldBankSourcesOpen] = useState(false);
  const [mapEngine, setMapEngine] = useState<'leaflet' | 'vector'>('leaflet');

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract (3-Zone strict layout) */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        countries={COUNTRIES_DATA}
        onSelectCountry={country => setSelectedCountry(country)}
        onOpenMethodology={() => setIsMethodologyOpen(true)}
        onOpenWorldBankSources={() => setIsWorldBankSourcesOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col relative">
        {activeTab === 'map' && (
          <>
            {/* Map Engine Selector Switch */}
            <div className="absolute top-3.5 right-4 z-30 flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 backdrop-blur-md text-xs shadow-xl">
              <button
                onClick={() => setMapEngine('vector')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  mapEngine === 'vector'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Vector Map</span>
              </button>
              <button
                onClick={() => setMapEngine('leaflet')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  mapEngine === 'leaflet'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Map className="h-3.5 w-3.5" />
                <span>Leaflet GIS</span>
              </button>
            </div>

            {mapEngine === 'vector' ? (
              <WorldMap
                countries={COUNTRIES_DATA}
                selectedCountry={selectedCountry}
                onSelectCountry={country => setSelectedCountry(country)}
                selectedRegion={selectedRegion}
                onSelectRegion={region => setSelectedRegion(region)}
                activeMetric={activeMetric}
                setActiveMetric={metric => setActiveMetric(metric)}
              />
            ) : (
              <LeafletMap
                countries={COUNTRIES_DATA}
                selectedCountry={selectedCountry}
                onSelectCountry={country => setSelectedCountry(country)}
                selectedRegion={selectedRegion}
                onSelectRegion={region => setSelectedRegion(region)}
                activeMetric={activeMetric}
                setActiveMetric={metric => setActiveMetric(metric)}
              />
            )}
          </>
        )}

        {activeTab === 'explorer' && (
          <CrossCountryExplorer
            countries={COUNTRIES_DATA}
            onSelectCountry={country => setSelectedCountry(country)}
          />
        )}
      </main>

      {/* Country Detail & Econometric Predictive Studio Modal */}
      {selectedCountry && (
        <CountryDetailModal
          country={selectedCountry}
          onClose={() => setSelectedCountry(null)}
          onSelectCountry={c => setSelectedCountry(c)}
          allCountries={COUNTRIES_DATA}
        />
      )}

      {/* Econometric Methodology Documentation Modal */}
      {(isMethodologyOpen || activeTab === 'methodology') && (
        <ModelMethodologyModal
          onClose={() => {
            setIsMethodologyOpen(false);
            if (activeTab === 'methodology') setActiveTab('map');
          }}
        />
      )}

      {/* Official World Bank Sources & API Live Query Explorer Modal */}
      {isWorldBankSourcesOpen && (
        <WorldBankSourcesModal
          onClose={() => setIsWorldBankSourcesOpen(false)}
          countries={COUNTRIES_DATA}
          initialCountry={selectedCountry}
        />
      )}
    </div>
  );
}
