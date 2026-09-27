export type IndicatorType = 'conflict' | 'gdp' | 'hdi' | 'hci' | 'inflation' | 'displacement';

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
  hdi: {
    code: 'IQ.CPA.PRES.XQ',
    name: 'Human Capital & Social Inclusion Rating',
    sourceId: '2',
    sourceName: 'World Development Indicators (Source ID: 2)',
    unit: 'Index (0-1 scale)',
    description: 'World Bank human resources and socioeconomic development assessment.'
  },
  hci: {
    code: 'WB_HCIP',
    name: 'Human Capital Index Plus (HCI+) - World Bank Data360',
    sourceId: 'WB_HCIP',
    sourceName: 'World Bank Data360 (dataset/WB_HCIP)',
    unit: 'Points (0 - 325 scale)',
    description: 'World Bank Human Capital Index Plus (Data360 dataset WB_HCIP). Measures human capital accumulated across Health (0-100), Education (0-125), and On-the-Job Learning (0-100) on a 0-325 scale, where 1 point equals ~1% higher future labor income and productivity.'
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

export interface HciPlusBreakdown {
  totalScore: number; // Overall HCI+ on 0 - 325 scale (1 pt = ~1% higher future labor earnings)
  healthPillarScore: number; // Health Pillar: 0 - 100 points (child survival, stunting, adult survival)
  educationPillarScore: number; // Education Pillar: 0 - 125 points (LAYS, HLO test scores, tertiary education)
  employmentPillarScore: number; // On-the-job Learning Pillar: 0 - 100 points (wage employment, labor participation, workplace skills)
  childSurvivalRate: number; // Probability of survival to age 5 (0 - 100%)
  learningAdjustedSchoolYears: number; // LAYS (0 - 14 years)
  expectedYearsOfSchool: number; // EYRS (0 - 14 years)
  harmonizedTestScore: number; // Harmonized Learning Outcome (HLO) on 300-625 scale (325 minimum basic proficiency floor)
  adultSurvivalRate: number; // Survival rate of 15-year-olds to age 60 (0 - 100%)
  tertiaryAttainmentRate: number; // Tertiary education completion / skills rate (0 - 100%)
  productiveEmploymentRate: number; // Productive wage employment / labor attachment (0 - 100%)
  frontierSkillsScore: number; // Digital, STEM & cognitive adaptability (0 - 100)
  conflictProductivityPenaltyPct: number; // Estimated % loss of next-generation lifetime productivity due to conflict/fragility
  expectedWorkforceProductivity: number; // Expected productivity of future worker relative to complete benchmark (0 - 100%)
}

export interface TimeSeriesPoint {
  year: number;
  conflictIntensity: number; // 0 - 100 scale (derived from World Bank VC.BTL.DETH & PV.EST)
  battleFatalities: number; // estimated annual battle-related deaths (WB VC.BTL.DETH)
  gdpPerCapita: number; // in USD (WB NY.GDP.PCAP.CD / NY.GDP.PCAP.KD)
  gdpGrowthRate: number; // % annual growth (WB NY.GDP.MKTP.KD.ZG)
  hdi: number; // 0.000 - 1.000 scale
  hciPlus: number; // 0.000 - 1.000 scale (WB Source 63 HD.HCI.OVRL augmented)
  inflationRate: number; // % annual CPI (WB FP.CPI.TOTL.ZG)
  displacedPersons: number; // in thousands (WB SM.POP.REFG.OR)
  eventNote?: string; // key historical geopolitical event marker
  dataSourceNote?: string; // note specifying dataset added or gap-filling method
  datasetTag?: string; // short source tag, e.g. UCDP/UNDP/IMF/UNHCR
  isGapFilled?: boolean; // flag indicating if this year was added to fill historical gap
}

export interface EconometricProfile {
  conflictGdpCorrelation: number; // Pearson r between conflict and GDP per capita
  conflictHdiCorrelation: number; // Pearson r between conflict and HDI
  conflictHciCorrelation: number; // Pearson r between conflict and HCI+
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
  currentHdi: number; // 0 - 1
  currentHciPlus: number; // 0 - 1 scale (WB Source 63 HD.HCI.OVRL augmented)
  hciBreakdown?: HciPlusBreakdown;
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
  projectedHdi: number;
  hdiUpperBand: number;
  hdiLowerBand: number;
  projectedHciPlus: number;
  hciPlusUpperBand: number;
  hciPlusLowerBand: number;
  projectedDisplaced: number;
  cumulativePeaceDividendUSD: number; // Net economic gain or loss vs baseline
}
