import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  X, 
  CheckCircle2, 
  Code, 
  Globe2, 
  Layers, 
  AlertCircle,
  Play
} from 'lucide-react';
import { WORLD_BANK_SOURCES, WorldBankSource } from '../data/worldBankSources';
import { fetchWorldBankSources, fetchWorldBankIndicator } from '../services/worldBankApi';
import { WORLD_BANK_INDICATORS, CountryData } from '../types';

interface WorldBankSourcesModalProps {
  onClose: () => void;
  countries: CountryData[];
  initialCountry?: CountryData | null;
}

export const WorldBankSourcesModal: React.FC<WorldBankSourcesModalProps> = ({
  onClose,
  countries,
  initialCountry,
}) => {
  const [sources, setSources] = useState<WorldBankSource[]>(WORLD_BANK_SOURCES);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<WorldBankSource>(
    WORLD_BANK_SOURCES.find(s => s.id === '2') || WORLD_BANK_SOURCES[0]
  );

  // Live Query Console State
  const [queryCountry, setQueryCountry] = useState<string>(initialCountry?.id || 'UKR');
  const [queryIndicator, setQueryIndicator] = useState<string>('NY.GDP.PCAP.CD');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [queryUrl, setQueryUrl] = useState<string>('');

  // Fetch fresh sources from World Bank API on mount
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const liveSources = await fetchWorldBankSources();
        if (isMounted && liveSources.length > 0) {
          setSources(liveSources);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  const filteredSources = sources.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.includes(searchQuery)
  );

  const handleExecuteLiveQuery = async () => {
    setIsQuerying(true);
    const url = `https://api.worldbank.org/v2/country/${queryCountry}/indicator/${queryIndicator}?format=json&date=2015:2024&per_page=10`;
    setQueryUrl(url);

    try {
      const records = await fetchWorldBankIndicator(queryCountry, queryIndicator, '2015:2024');
      setQueryResult(records);
    } catch (err: any) {
      setQueryResult({ error: err.message });
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl border border-slate-700 bg-[#0B0F17] shadow-2xl overflow-hidden">
        
        {/* Header with World Bank API Branding */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white leading-tight">World Bank Data Sources Catalog</h3>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Live API v2
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                Endpoint:
                <a 
                  href="https://api.worldbank.org/v2/sources" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1"
                >
                  https://api.worldbank.org/v2/sources
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Overview Banner */}
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 text-xs text-slate-300">
            <p className="leading-relaxed">
              All conflict, macroeconomic, and development indicators across this platform are sourced solely from the 
              official <strong>World Bank API (api.worldbank.org/v2)</strong>. Primary data is extracted from 
              <strong> Source ID 2: World Development Indicators (WDI)</strong> and 
              <strong> Source ID 3: Worldwide Governance Indicators (WGI)</strong>, capturing battle-related deaths, 
              political stability, GDP per capita, inflation, and refugee populations across 174 countries.
            </p>
          </div>

          {/* Interactive Live Query Console */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Code className="h-4 w-4 text-amber-400" />
                Live World Bank API Query Tester
              </h4>
              <span className="text-[11px] text-slate-400">Direct query to World Bank servers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
              <div>
                <label className="text-slate-400 block mb-1">Target Country (ISO-3):</label>
                <select
                  value={queryCountry}
                  onChange={e => setQueryCountry(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {countries.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.flag} {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">World Bank Indicator Series:</label>
                <select
                  value={queryIndicator}
                  onChange={e => setQueryIndicator(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="NY.GDP.PCAP.CD">NY.GDP.PCAP.CD - GDP per capita (current US$)</option>
                  <option value="NY.GDP.PCAP.KD">NY.GDP.PCAP.KD - GDP per capita (constant 2015 US$)</option>
                  <option value="FP.CPI.TOTL.ZG">FP.CPI.TOTL.ZG - Inflation, consumer prices (%)</option>
                  <option value="VC.BTL.DETH">VC.BTL.DETH - Battle-related deaths (people)</option>
                  <option value="PV.EST">PV.EST - Political Stability & Absence of Violence</option>
                  <option value="SM.POP.REFG.OR">SM.POP.REFG.OR - Refugee population by origin</option>
                  <option value="MS.MIL.XPND.GD.ZS">MS.MIL.XPND.GD.ZS - Military expenditure (% of GDP)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleExecuteLiveQuery}
                  disabled={isQuerying}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-1.5 text-xs transition-colors disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {isQuerying ? 'Querying World Bank...' : 'Execute Live API Query'}
                </button>
              </div>
            </div>

            {queryUrl && (
              <div className="rounded-lg bg-black/50 p-2.5 font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto">
                <span className="text-slate-500">GET </span>
                <span className="text-amber-400">{queryUrl}</span>
              </div>
            )}

            {queryResult && (
              <div className="mt-2.5 max-h-48 overflow-y-auto rounded-lg bg-black/70 p-3 font-mono text-[11px] text-emerald-400 border border-slate-800">
                <pre>{JSON.stringify(queryResult, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Catalog of Sources */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-400" />
                All Official World Bank Sources ({sources.length} Databases)
              </h4>

              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter sources..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-48 rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Sources Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">ID</th>
                      <th className="py-2.5 px-4">Source Name</th>
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4">Last Updated</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {filteredSources.map(s => {
                      const isHighlighted = s.id === '2' || s.id === '3';
                      return (
                        <tr 
                          key={s.id} 
                          className={`hover:bg-slate-800/50 transition-colors ${
                            isHighlighted ? 'bg-blue-500/10' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 text-slate-400">#{s.id}</td>
                          <td className="py-2.5 px-4 font-sans font-medium text-white flex items-center gap-2">
                            <span>{s.name}</span>
                            {isHighlighted && (
                              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.2 rounded border border-blue-500/30">
                                Primary Source
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-amber-400">{s.code}</td>
                          <td className="py-2.5 px-4 text-slate-400">{s.lastupdated || 'Active'}</td>
                          <td className="py-2.5 px-4">
                            <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                              Available
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-900/60 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
          <span>Powered solely by the official World Bank Data API v2</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-1.5 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
