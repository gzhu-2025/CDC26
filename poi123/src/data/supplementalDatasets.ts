export interface SupplementalDataset {
  id: string;
  name: string;
  provider: string;
  code: string;
  metricsCovered: string[];
  yearRange: string;
  roleInGapFilling: string;
  methodology: string;
  citation: string;
  url: string;
  isAddedDataset: boolean;
}

export const SUPPLEMENTAL_DATASETS: SupplementalDataset[] = [
  {
    id: 'ucdp-prio-v24',
    name: 'UCDP/PRIO Georeferenced Event Dataset (GED) v24.1',
    provider: 'Uppsala Conflict Data Program (Uppsala University) & PRIO',
    code: 'UCDP_GED_241',
    metricsCovered: ['Battle Fatalities', 'Conflict Severity Index (0-100)', 'Organized Violence Events'],
    yearRange: '1995 – 2025',
    roleInGapFilling: 'Fills annual non-benchmark years (1996–1999, 2001–2004, 2006–2009, 2011–2014, 2016, 2017, 2019, 2021, 2023, 2025) for battle deaths and conflict intensity.',
    methodology: 'Aggregates georeferenced event logs, casualty reports, and state/non-state fatality estimates, smoothed with PCHIP monotonic Hermite spline interpolation for missing micro-months.',
    citation: 'Sundberg, Ralph, and Erik Melander. "Introducing the UCDP Georeferenced Event Dataset." Journal of Peace Research 50.4 (2013): 523-532.',
    url: 'https://ucdp.uu.se/downloads/',
    isAddedDataset: true,
  },
  {
    id: 'undp-hdro-annual',
    name: 'UNDP Human Development Report Office (HDRO) Annual Historical Series',
    provider: 'United Nations Development Programme (UNDP)',
    code: 'UNDP_HDI_HIST',
    metricsCovered: ['Human Development Index (HDI)', 'Life Expectancy Index', 'Education Index', 'GNI Index'],
    yearRange: '1990 – 2025',
    roleInGapFilling: 'Provides continuous annual HDI ratings, bridging 5-year census gaps into an uninterrupted annual series (1995–2025).',
    methodology: 'Reconciles national statistical office census revisions with UNDP geometric mean calculations across health, education, and standard-of-living sub-indices.',
    citation: 'UNDP (2024). Human Development Report 2023/2024: Breaking the Gridlock. New York: United Nations Development Programme.',
    url: 'https://hdr.undp.org/data-center/human-development-index',
    isAddedDataset: true,
  },
  {
    id: 'unhcr-idmc-grid',
    name: 'UNHCR Global Trends & IDMC Global Internal Displacement Database (GRID)',
    provider: 'UN High Commissioner for Refugees (UNHCR) & IDMC',
    code: 'UNHCR_IDMC_GRID',
    metricsCovered: ['Refugees & Asylum Seekers', 'Internally Displaced Persons (IDPs)', 'Cross-Border Forced Migration'],
    yearRange: '1995 – 2025',
    roleInGapFilling: 'Supplies annual refugee, asylum seeker, and internally displaced population figures across all 174 countries for missing gap years.',
    methodology: 'Combines UNHCR mid-year population statistics, UNRWA registration files, and IDMC event-based disaster and conflict displacement monitoring logs.',
    citation: 'UNHCR (2024). Global Trends: Forced Displacement in 2023/2024. Geneva: UNHCR; IDMC (2024) Global Report on Internal Displacement.',
    url: 'https://www.unhcr.org/refugee-statistics/',
    isAddedDataset: true,
  },
  {
    id: 'imf-weo-2025',
    name: 'IMF World Economic Outlook (WEO) & World Bank WDI National Accounts',
    provider: 'International Monetary Fund (IMF) & World Bank Group',
    code: 'IMF_WEO_WB_WDI',
    metricsCovered: ['GDP per Capita (constant USD)', 'Real GDP Growth Rate (%)', 'Consumer Price Index Inflation (%)'],
    yearRange: '1995 – 2025',
    roleInGapFilling: 'Fills intermediate macroeconomic years with verified national accounts data, capturing sudden recession shocks, hyperinflation surges, and postwar recoveries.',
    methodology: 'Harmonizes IMF Article IV consultation series with World Bank WDI national accounts, applying local currency GDP deflators and annual CPI averages.',
    citation: 'IMF World Economic Outlook Database (April 2025 Update); World Bank World Development Indicators (2024/2025).',
    url: 'https://www.imf.org/en/Publications/WEO/weo-database',
    isAddedDataset: true,
  },
  {
    id: 'wb-data360-hcip-pwt',
    name: 'World Bank Data360 Human Capital Index Plus (WB_HCIP) & Penn World Table 10.01',
    provider: 'World Bank Group & Groningen Growth and Development Centre (GGDC)',
    code: 'WB_HCIP_PWT10',
    metricsCovered: ['HCI+ Total Score (0–325 scale)', 'Health Pillar (0-100)', 'Education Pillar (0-125)', 'On-the-Job Learning (0-100)'],
    yearRange: '1995 – 2025',
    roleInGapFilling: 'Generates annual HCI+ human capital trajectory tracking, modeling learning loss and health shocks during active conflict years.',
    methodology: 'Combines World Bank Data360 WB_HCIP baseline indicators with Penn World Table human capital index per worker, adjusted for conflict-induced school closures and adult survival drops.',
    citation: 'World Bank (2024) Data360 Dataset WB_HCIP; Feenstra, Inklaar and Timmer (2021), "The Next Generation of the Penn World Table" AER.',
    url: 'https://data360.worldbank.org/en/dataset/WB_HCIP',
    isAddedDataset: true,
  },
  {
    id: 'sipri-milex-2025',
    name: 'SIPRI Military Expenditure & Arms Transfers Database',
    provider: 'Stockholm International Peace Research Institute (SIPRI)',
    code: 'SIPRI_MILEX',
    metricsCovered: ['Military Expenditure (% GDP)', 'Defense Spending Burden', 'Arms Imports/Exports'],
    yearRange: '1995 – 2025',
    roleInGapFilling: 'Informs conflict cost estimates, peace dividend potential, and institutional governance resilience coefficients.',
    methodology: 'Standardizes official government defense budget reports, UN military expenditure filings, and defense intelligence estimates into constant USD values.',
    citation: 'SIPRI Military Expenditure Database (2024/2025 Edition). Stockholm International Peace Research Institute.',
    url: 'https://www.sipri.org/databases/milex',
    isAddedDataset: true,
  },
];
