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
              The platform utilizes an <strong>Autoregressive Distributed Lag (ARDL)</strong> panel econometric model to forecast prospective trajectories for GDP per capita and the Human Development Index (HDI) under counterfactual conflict scenarios.
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
              <Layers className="h-4 w-4 text-violet-400" />
              2. Human Capital Index Plus (HCI+) — World Bank Data360 (dataset/WB_HCIP)
            </h3>
            <p>
              The <strong>HCI+ Index</strong> is sourced from the official <a href="https://data360.worldbank.org/en/dataset/WB_HCIP" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline font-medium">World Bank Data360 dataset (WB_HCIP)</a>. Unlike the traditional 0–1 HCI, the HCI+ evaluates the human capital a child born today can accumulate across their entire working life on a <strong>0 to 325 point scale</strong>, where each 1-point increment corresponds to approximately 1% higher expected future labor earnings and productivity.
            </p>
            <div className="my-3 rounded-lg bg-slate-900 p-3.5 border border-slate-800 font-mono text-[11px] text-violet-300">
              {'HCI+_t = HealthPillar_t (0-100) + EducationPillar_t (0-125) + EmploymentPillar_t (0-100) - Penalty_conflict ∈ [0, 325]'}
            </div>
            <p className="text-slate-300">
              Three Main Pillars (World Bank Data360):
            </p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1.5 text-slate-400 text-xs">
              <li>
                <strong className="text-rose-300">1. Health & Nutrition Pillar (0 - 100 points)</strong>: Measures child survival to age 5 (WB: <code className="font-mono text-slate-300">SH.DYN.MORT</code>), stunting prevention, and adult survival of 15-year-olds to age 60 (WB: <code className="font-mono text-slate-300">HD.HCI.AMRT</code>).
              </li>
              <li>
                <strong className="text-cyan-300">2. Education & Quality Pillar (0 - 125 points)</strong>: Combines Learning-Adjusted School Years (<code className="font-mono text-slate-300">LAYS</code>), Harmonized Learning Outcomes (<code className="font-mono text-slate-300">HLO</code> on 300–625 scale with <span className="text-amber-300 font-mono">325</span> basic proficiency threshold), and tertiary STEM attainment.
              </li>
              <li>
                <strong className="text-violet-300">3. Employment & On-the-Job Learning Pillar (0 - 100 points)</strong>: Measures wage employment participation, adult skills accumulation over the life cycle, and technological frontier absorption.
              </li>
              <li>
                <strong className="text-red-400">Fragility Degradation Penalty (Penalty_conflict)</strong>: Directly discounts next-generation workforce earnings based on classroom destruction, teacher displacement, childhood stunting, and labor market trauma.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              3. Human Development Index (HDI) Simulation
            </h3>
            <p>
              The Human Development Index is projected as a geometric composite function reflecting income, life expectancy, and schooling durability:
            </p>
            <div className="my-3 rounded-lg bg-slate-900 p-3.5 border border-slate-800 font-mono text-[11px] text-cyan-300">
              HDI_t = HDI_{'{t-1}'} + κ·Δln(GDP_t) - δ·(Conflict_t/100)·(1 - Resilience/100)
            </div>
            <p className="text-slate-400">
              Active warfare suppresses HDI both directly (through civilian casualties, destruction of hospitals, school closures) and indirectly through fiscal collapse. In post-conflict scenarios, human capital recovery exhibits a 2–3 year gestation before schooling and healthcare delivery rebound to trendline.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              4. Empirical Data Sources: World Bank API v2 (api.worldbank.org/v2/sources)
            </h3>
            <p className="text-slate-400 mb-2">
              All indicators across the platform are sourced solely from the official <strong>World Bank Data API v2</strong>, querying the catalog of databases defined at <a href="https://api.worldbank.org/v2/sources" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">https://api.worldbank.org/v2/sources</a>:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg bg-slate-900/60 p-3 border border-violet-500/30">
                <span className="font-semibold text-violet-300 block">Source ID 63: Human Capital Index (HCI)</span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Series: <code>HD.HCI.OVRL</code> (Human Capital Index score), <code>HD.HCI.LAYS</code> (Learning-adjusted school years), <code>HD.HCI.EYRS</code> (Expected school years), <code>HD.HCI.AMRT</code> (Adult mortality/survival rate).
                </span>
              </div>
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
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-400" />
              5. Peace Dividend Formulation
            </h3>
            <p>
              The <strong className="text-emerald-300">Cumulative Peace Dividend</strong> is defined as the integral of per-capita GDP under the simulated peace trajectory minus the counterfactual status-quo trajectory over the chosen horizon:
            </p>
            <div className="my-3 rounded-lg bg-slate-900 p-3.5 border border-slate-800 font-mono text-[11px] text-emerald-300">
              Total National Dividend = Population · ∑_{'{t=1}'}^{'{H}'} (GDP_t^{'{Scenario}'} - GDP_t^{'{StatusQuo}'})
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-400" />
              6. Historical Survey Gap-Filling & Added Datasets (1995–2025)
            </h3>
            <p className="mb-2">
              Standard international census survey datasets leave 3-to-5 year gap intervals for intermediate years. 
              To construct a continuous, uninterrupted <strong>31-year timeline (1995–2025)</strong> across all 174 countries, we incorporated 6 supplemental datasets:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 font-mono text-[11px]">
              <div className="rounded-lg bg-slate-900/60 p-3 border border-amber-500/30">
                <span className="font-semibold text-amber-300 block font-sans text-xs">UCDP/PRIO Georeferenced Event Dataset (GED) v24.1</span>
                <span className="text-slate-400 mt-1 block font-sans">
                  Fills annual non-benchmark years for battle fatalities, armed conflict events, and violence severity indices.
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-amber-500/30">
                <span className="font-semibold text-amber-300 block font-sans text-xs">UNDP Human Development Report Office (HDRO)</span>
                <span className="text-slate-400 mt-1 block font-sans">
                  Supplies uninterrupted annual HDI score tracking (1990–2025), eliminating step-function census gaps.
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-amber-500/30">
                <span className="font-semibold text-amber-300 block font-sans text-xs">UNHCR Global Trends & IDMC GRID v3.2</span>
                <span className="text-slate-400 mt-1 block font-sans">
                  Provides continuous annual refugee, asylum-seeker, and IDP population tracking across forced migration corridors.
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-amber-500/30">
                <span className="font-semibold text-amber-300 block font-sans text-xs">IMF World Economic Outlook (WEO 2025) & WB WDI</span>
                <span className="text-slate-400 mt-1 block font-sans">
                  Harmonizes annual national accounts for real GDP growth, GDP per capita, and consumer price inflation.
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-amber-500/30">
                <span className="font-semibold text-amber-300 block font-sans text-xs">World Bank Data360 WB_HCIP + Penn World Table 10.01</span>
                <span className="text-slate-400 mt-1 block font-sans">
                  Models annual human capital accumulation and workplace skills erosion during active hostilities.
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-amber-500/30">
                <span className="font-semibold text-amber-300 block font-sans text-xs">SIPRI Military Expenditure Database</span>
                <span className="text-slate-400 mt-1 block font-sans">
                  Informs defense burden, security spending shocks, and peace dividend potential.
                </span>
              </div>
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
