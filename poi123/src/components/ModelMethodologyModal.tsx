import React from 'react';
import { X, BookOpen, Layers, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';

interface ModelMethodologyModalProps {
  onClose: () => void;
}

export const ModelMethodologyModal: React.FC<ModelMethodologyModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-[#0B0F17] shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#0E1522] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Econometric Forecasting Model & Data Methodology</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300 leading-relaxed">
          
          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              1. Theoretical Framework & Model Equations
            </h3>
            <p>
              The platform utilizes an <strong>Autoregressive Distributed Lag (ARDL)</strong> panel econometric model to forecast prospective trajectories for GDP per capita and the World Bank Human Capital Index Plus (HCI+) under counterfactual conflict scenarios.
            </p>
            <div className="my-3 rounded-lg bg-slate-900 p-3.5 border border-slate-800 font-mono text-[11px] text-amber-300">
              ln(GDP_t) = α + γ·ln(GDP_{'{t-1}'}) - β_0·(Conflict_t/100) - β_1·(Conflict_{'{t-1}'}/100) + λ·Aid_t + ε_t
            </div>
            <p>
              Where:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
              <li><strong className="text-slate-200">β_0, β_1</strong> represents the contemporaneous and 1-year lagged elasticity of conflict shocks (estimated between 0.028 and 0.048 across active civil conflicts).</li>
              <li><strong className="text-slate-200">γ</strong> is the persistence parameter (autoregressive coefficient ~0.94), accounting for economic hysteresis.</li>
              <li><strong className="text-slate-200">λ</strong> is the capital efficiency multiplier of reconstruction aid, moderated by national institutional resilience.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              2. Human Capital Index Plus (HCI+) Simulation
            </h3>
            <p>
              The World Bank Human Capital Index Plus (HCI+) is projected as a dynamic composite function reflecting expected worker productivity, childhood survival, learning-adjusted schooling years, and adult health outcomes:
            </p>
            <div className="my-3 rounded-lg bg-slate-900 p-3.5 border border-slate-800 font-mono text-[11px] text-cyan-300">
              HCI+_t = HCI+_{'{t-1}'} + κ·Δln(GDP_t) - δ·(Conflict_t/100)·(1 - Resilience/100)
            </div>
            <p className="text-slate-400">
              Active warfare suppresses HCI+ both directly (through civilian casualties, destruction of hospitals, school closures, child malnutrition) and indirectly through fiscal collapse. In post-conflict scenarios, human capital recovery exhibits a 2–3 year gestation before schooling and healthcare delivery rebound to trendline.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              3. Empirical Data Sources: World Bank API v2 (api.worldbank.org/v2/sources)
            </h3>
            <p className="text-slate-400 mb-2">
              All indicators across the platform are sourced solely from the official <strong>World Bank Data API v2</strong>, querying the catalog of databases defined at <a href="https://api.worldbank.org/v2/sources" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">https://api.worldbank.org/v2/sources</a>:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                <span className="font-semibold text-white block">Source ID 2: World Development Indicators (WDI)</span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Series: <code>VC.BTL.DETH</code> (Battle deaths), <code>NY.GDP.PCAP.CD</code> (GDP per capita), <code>FP.CPI.TOTL.ZG</code> (Inflation), <code>SM.POP.REFG.OR</code> (Refugees by origin), <code>SP.POP.TOTL</code> (Population).
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                <span className="font-semibold text-white block">Source ID 3: Worldwide Governance Indicators (WGI)</span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Series: <code>PV.EST</code> (Political Stability & Absence of Violence/Terrorism), <code>RL.EST</code> (Rule of Law), <code>GE.EST</code> (Government Effectiveness), <code>CC.EST</code> (Control of Corruption).
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                <span className="font-semibold text-white block">Source ID 15: Global Economic Monitor (GEM)</span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  High-frequency national economic accounts, trade flows, exchange rates, and commodity price dynamics.
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                <span className="font-semibold text-white block">World Bank Country Classifications</span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Standard ISO 3166-1 alpha-3 sovereign nation codes, geographic coordinates, administrative capital cities, and regional boundaries.
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-400" />
              4. Peace Dividend Formulation
            </h3>
            <p>
              The <strong className="text-emerald-300">Cumulative Peace Dividend</strong> is defined as the integral of per-capita GDP under the simulated peace trajectory minus the counterfactual status-quo trajectory over the chosen horizon:
            </p>
            <div className="my-3 rounded-lg bg-slate-900 p-3.5 border border-slate-800 font-mono text-[11px] text-emerald-300">
              Total National Dividend = Population · ∑_{'{t=1}'}^{'{H}'} (GDP_t^{'{Scenario}'} - GDP_t^{'{StatusQuo}'})
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-[#0E1522] px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            Close Methodology
          </button>
        </div>

      </div>
    </div>
  );
};
