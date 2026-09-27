export type IndicatorType = 'conflict' | 'gdp' | 'hci' | 'hdi' | 'inflation' | 'displacement';

export type Region = 
  | 'All'
  | 'Middle East & North Africa'
  | 'Sub-Saharan Africa'
  | 'Eastern Europe & Eurasia'
  | 'South & Southeast Asia'
  | 'Latin America & Caribbean'
  | 'North America & Europe';

export interface WorldBankIndicatorMeta {
  code: string;
  name: string;
  sourceId: string;
  sourceName: string;
  unit: string;
  description: string;
}

export interface HciPlusBreakdown {
  compositeScore: number; // World Bank HD.HCI.OVRL (0.000 - 1.000)
  underFiveSurvivalRate: number; // % (World Bank SH.DYN.MORT inverted)
  expectedYearsOfSchool: number; // years (World Bank HD.HCI.EYRS)
  harmonizedTestScore: number; // score 300 - 625 (World Bank HD.HCI.HLOS)
  learningAdjustedYears: number; // years (World Bank HD.HCI.LAYS)
  adultSurvivalRate: number; // % (World Bank HD.HCI.ASVR)
  healthyGrowthNonStuntedRate: number; // % (World Bank HD.HCI.STNT)
}

export const WORLD_BANK_INDICATORS: Record<string, WorldBankIndicatorMeta> = {
  conflict: {
    code: 'VC.BTL.DETH',
    name: 'Battle-related deaths & Conflict Severity Index',
    sourceId: '2',
    sourceName: 'World Development Indicators (Source ID: 2)',
    unit: 'Casualties / Normalized Index 0-100',
    description: 'Battle-related deaths are deaths in conflicts involving at least one state or armed group, reported by World Bank WDI.'
  },
  gdp: {
    code: 'NY.GDP.PCAP.CD',
    name: 'GDP per capita (constant / current USD)',
    sourceId: '2',
    sourceName: 'World Development Indicators (Source ID: 2)',
    unit: 'USD',
    description: 'Gross domestic product divided by midyear population, reported in World Bank national accounts data.'
  },
  hci: {
    code: 'HD.HCI.OVRL',
    name: 'Human Capital Index Plus (HCI+)',
    sourceId: '2',
    sourceName: 'World Development Indicators (Source ID: 2)',
    unit: 'HCI+ (0.000 - 1.000 scale)',
    description: 'World Bank Human Capital Index Plus (HCI+) measuring expected worker productivity, childhood survival, learning-adjusted schooling, and health outcomes.'
  },
  hdi: {
    code: 'HD.HCI.OVRL',
    name: 'Human Capital Index Plus (HCI+)',
    sourceId: '2',
    sourceName: 'World Development Indicators (Source ID: 2)',
    unit: 'HCI+ (0.000 - 1.000 scale)',
    description: 'World Bank Human Capital Index Plus (HCI+) measuring expected worker productivity, childhood survival, learning-adjusted schooling, and health outcomes.'
  },
  inflation: {
    code: 'FP.CPI.TOTL.ZG',
    name: 'Inflation, consumer prices (annual %)',
    sourceId: '2',
    sourceName: 'World Development Indicators (Source ID: 2)',
    unit: 'Annual %',
    description: 'Inflation as measured by the consumer price index reflects the annual percentage change in the cost to the average consumer.'
  },
  displacement: {
    code: 'SM.POP.REFG.OR',
    name: 'Refugee & Displaced Population by Country of Origin',
    sourceId: '2',
    sourceName: 'World Development Indicators (Source ID: 2)',
    unit: 'Thousands',
    description: 'Refugees and displaced persons classified by country or territory of origin from World Bank WDI data.'
  },
  governance: {
    code: 'PV.EST',
    name: 'Political Stability and Absence of Violence/Terrorism',
    sourceId: '3',
    sourceName: 'Worldwide Governance Indicators (Source ID: 3)',
    unit: 'Estimate (-2.5 to +2.5)',
    description: 'Measures perceptions of the likelihood that the government will be destabilized or overthrown by unconstitutional or violent means.'
  },
};

export interface TimeSeriesPoint {
  year: number;
  conflictIntensity: number; // 0 - 100 scale (derived from World Bank VC.BTL.DETH & PV.EST)
  battleFatalities: number; // estimated annual battle-related deaths (WB VC.BTL.DETH)
  gdpPerCapita: number; // in USD (WB NY.GDP.PCAP.CD / NY.GDP.PCAP.KD)
  gdpGrowthRate: number; // % annual growth (WB NY.GDP.MKTP.KD.ZG)
  hciPlus: number; // 0.000 - 1.000 scale (World Bank Human Capital Index Plus HD.HCI.OVRL)
  hdi?: number; // compat alias
  inflationRate: number; // % annual CPI (WB FP.CPI.TOTL.ZG)
  displacedPersons: number; // in thousands (WB SM.POP.REFG.OR)
  eventNote?: string; // key historical geopolitical event marker
}

export interface EconometricProfile {
  conflictGdpCorrelation: number; // Pearson r between conflict and GDP per capita
  conflictHciCorrelation: number; // Pearson r between conflict and HCI Plus
  conflictHdiCorrelation?: number; // compat alias
  lagImpactYears: number; // Estimated time lag for maximum economic shock (years)
  estimatedAnnualCostPct: number; // % GDP growth loss per 10 pt increase in conflict
  peaceDividendPotential: number; // Estimated % GDP bounce per 10 pt de-escalation
  institutionalResilience: number; // 0 - 100 governance / recovery capacity (from WB WGI)
}

export interface CountryData {
  id: string; // ISO 3166-1 alpha-3 code matching World Bank API (e.g. UKR, SYR, YEM, RWA)
  name: string;
  region: Region;
  flag: string;
  capital: string;
  population: number; // in millions (WB SP.POP.TOTL)
  currentConflictIntensity: number; // 0 - 100
  currentGdpPerCapita: number; // in USD (WB NY.GDP.PCAP.CD)
  currentHciPlus: number; // 0 - 1 (World Bank HD.HCI.OVRL)
  currentHdi?: number; // compat alias
  currentInflation: number; // % (WB FP.CPI.TOTL.ZG)
  currentDisplaced: number; // in thousands (WB SM.POP.REFG.OR)
  conflictStatus: 'Active War' | 'High Intensity' | 'Protracted Insurgency' | 'Post-Conflict Recovery' | 'Stable / Benchmark';
  mapCoords: {
    x: number; // SVG coordinate 0 - 1000
    y: number; // SVG coordinate 0 - 550
  };
  lat: number;
  lng: number;
  econometrics: EconometricProfile;
  history: TimeSeriesPoint[];
  hciBreakdown?: HciPlusBreakdown;
}

export interface ForecastScenario {
  targetConflictIntensity: number; // User set 0 - 100
  horizonYears: number; // 1 - 10 years
  reconstructionAidAnnualUSD: number; // Per capita annual aid ($)
  resilienceFactor: number; // 0.5 to 1.5 multiplier
}

export interface ForecastPoint {
  year: number;
  projectedGdpPerCapita: number;
  gdpUpperBand: number;
  gdpLowerBand: number;
  projectedHciPlus: number;
  hciUpperBand: number;
  hciLowerBand: number;
  projectedHdi?: number; // compat alias
  hdiUpperBand?: number;
  hdiLowerBand?: number;
  projectedDisplaced: number;
  cumulativePeaceDividendUSD: number; // Net economic gain or loss vs baseline
}
