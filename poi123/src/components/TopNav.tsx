import React from 'react';
import { Globe, BarChart3, TrendingUp, BookOpen, Search, X, Database } from 'lucide-react';
import { CountryData } from '../types';

interface TopNavProps {
  activeTab: 'map' | 'explorer' | 'methodology';
  setActiveTab: (tab: 'map' | 'explorer' | 'methodology') => void;
  countries: CountryData[];
  onSelectCountry: (country: CountryData) => void;
  onOpenMethodology: () => void;
  onOpenWorldBankSources: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  countries,
  onSelectCountry,
  onOpenMethodology,
  onOpenWorldBankSources,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  const filteredCountries = searchQuery.trim()
    ? countries.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.region.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#0B0F17]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={e => {
              e.preventDefault();
              setActiveTab('map');
            }}
            className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-white transition-opacity hover:opacity-90"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 text-amber-400">
              <Globe className="h-4 w-4" />
            </div>
            <span>Conflict & Prosperity Observatory</span>
          </a>
        </div>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors rounded-md ${
              activeTab === 'map'
                ? 'text-white bg-slate-800/80 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Interactive Map</span>
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors rounded-md ${
              activeTab === 'explorer'
                ? 'text-white bg-slate-800/80 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Cross-Country Explorer</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('methodology');
              onOpenMethodology();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors rounded-md ${
              activeTab === 'methodology'
                ? 'text-white bg-slate-800/80 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Econometric Model</span>
          </button>

          <button
            onClick={onOpenWorldBankSources}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 transition-colors"
          >
            <Database className="h-3.5 w-3.5" />
            <span>Data & Sources Catalog</span>
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="relative flex items-center gap-2.5">
          <div className="relative">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:bg-slate-800/80 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Search nation...</span>
              <kbd className="hidden lg:inline text-[10px] text-slate-500 font-mono bg-slate-800 px-1 py-0.5 rounded">⌘K</kbd>
            </button>

            {/* Quick search dropdown */}
            {isSearchOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl z-50">
                <div className="flex items-center border-b border-slate-800 px-2 pb-2">
                  <Search className="h-3.5 w-3.5 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Type country name or code..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto pt-1 divide-y divide-slate-800/50">
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map(country => (
                      <button
                        key={country.id}
                        onClick={() => {
                          onSelectCountry(country);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex w-full items-center justify-between px-2.5 py-2 text-left text-xs hover:bg-slate-800/80 rounded-md transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{country.flag}</span>
                          <div>
                            <span className="font-medium text-white">{country.name}</span>
                            <span className="block text-[10px] text-slate-400">{country.region}</span>
                          </div>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className={`text-[11px] font-semibold ${
                            country.currentConflictIntensity > 70
                              ? 'text-red-400'
                              : country.currentConflictIntensity > 30
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}>
                            CI: {country.currentConflictIntensity}
                          </span>
                          <span className="block text-[10px] text-violet-400 font-mono font-medium">
                            HCI+ {country.currentHciPlus} pts
                          </span>
                        </div>
                      </button>
                    ))
                  ) : searchQuery ? (
                    <div className="p-3 text-center text-xs text-slate-500">No nations match &ldquo;{searchQuery}&rdquo;</div>
                  ) : (
                    <div className="p-2 text-center text-xs text-slate-500">Select from {countries.length} monitored nations</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              // Open Ukraine or highest conflict active country for instant demo
              const active = countries.find(c => c.id === 'UKR') || countries[0];
              onSelectCountry(active);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors shadow-sm whitespace-nowrap"
          >
            <span>Scenario Simulator</span>
          </button>
        </div>
      </div>
    </header>
  );
};
