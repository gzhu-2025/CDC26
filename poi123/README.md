# Conflict & Prosperity Econometric Observatory

A geospatial econometric dashboard and forecasting platform analyzing the correlation between armed conflicts and socio-economic indicators across **174 countries worldwide**, grounded **solely in the official World Bank Data API v2** ([api.worldbank.org/v2/sources](https://api.worldbank.org/v2/sources)).

---

## 1. World Bank API Data Provenance (`https://api.worldbank.org/v2/sources`)

All indicators, time-series data, country classifications, and governance metrics across this platform are derived **solely from the official World Bank Data API**:

1. **Source ID 2: World Development Indicators (WDI)**:
   - `VC.BTL.DETH`: Battle-related deaths (number of people) — empirical conflict severity.
   - `NY.GDP.PCAP.CD` / `NY.GDP.PCAP.KD`: Real & nominal GDP per capita in USD.
   - `FP.CPI.TOTL.ZG`: Inflation, consumer prices (annual %).
   - `SM.POP.REFG.OR`: Refugee & forced displaced population by country of origin.
   - `SP.POP.TOTL`: Total midyear national population.
   - `HD.HCI.OVRL`: Human Capital Index Plus (HCI+) — World Bank Human Capital Project.
   - `MS.MIL.XPND.GD.ZS`: Military expenditure (% of GDP).

2. **Source ID 3: Worldwide Governance Indicators (WGI)**:
   - `PV.EST`: Political Stability and Absence of Violence/Terrorism (normalized -2.5 to +2.5 scale).
   - `GE.EST`: Government Effectiveness.
   - `RL.EST`: Rule of Law & Institutional Resilience.
   - `CC.EST`: Control of Corruption.

3. **Live World Bank API Explorer & Catalog Modal (`src/components/WorldBankSourcesModal.tsx`)**:
   - Direct integration with `https://api.worldbank.org/v2/sources`, listing all 71 official World Bank databases.
   - Real-time **Live API Query Tester**: execute live requests directly against `api.worldbank.org` for any country and indicator code to inspect raw API responses.

---

## 2. Core Platform Architecture

### A. Dual Interactive Map Engines (`src/components/WorldMap.tsx` & `src/components/LeafletMap.tsx`)
- **Real-World GIS Cartography & True Satellite Imagery (Default Engine)**:
  - **Political Borders Mode (Primary Default)**: High-contrast political cartography featuring CartoDB Voyager sovereign state boundaries, country names, national capitals, and dedicated international boundary vector overlays.
  - **National Geographic Classic Political Mode**: Vintage world political map with distinct national territorial tints, borders, and administrative capitals.
  - **Real Photographic Satellite Imagery**: High-resolution NASA/Esri World Imagery showing genuine Earth terrain, deserts, vegetation, mountain ranges, and river basins.
  - **International Boundaries & Place Labels Overlay**: Sharp, semi-transparent real-world political boundaries and national place names rendered over the satellite base.
  - **4 Basemap Modes**: Political Borders, NatGeo Political, Real Satellite, and Tactical Dark Matter.
  - **Interactive GIS Physics**: True geographical coordinate projection (`lat`, `lng`), continuous zoom, and multi-phase container size recalculation (`invalidateSize()`).
  - **Animated Radar Conflict Ripples**: Concentric CSS radar waves around severe active war zones.
- **Realistic Vector World Map (Alternative View)**:
  - Geometrically accurate world continent coastlines (realistic peninsulas, bays, archipelagos, and islands across all continents).
  - Smooth drag-to-pan physics and continent region focus presets (Europe, MENA, Sub-Saharan Africa, Asia, Americas).
  - On-map search input for instantaneous filtering among all 174 monitored nations.
- **Dynamic Choropleth Layers**:
  - **Conflict Severity**: World Bank WDI-scaled continuous index (0–100 scale, from serene emerald to warning amber and critical crimson).
  - **Human Capital Index Plus (HCI+)**: World Bank Human Capital Project scale (0.000–1.000) measuring education, health, and worker productivity.
  - **Real GDP per Capita**: Log-scaled purchasing power representation in USD.
  - **Forced Displacement**: UNHCR/IDMC internal displacement and refugee headcount visualization.
- **Click Event & Country Drilldown Trigger**:
  - Clicking any nation on the map immediately triggers `onSelectCountry(country)`, opening the deep Country Detail Page with historical graphs (1995–2024), correlation metrics, and the predictive forecasting model.
  - **Real GDP per Capita**: Log-scaled purchasing power representation in USD.
  - **Forced Displacement**: UNHCR/IDMC internal displacement and refugee headcount visualization.
- **Controls & Filters**: Pan, zoom in/out, view reset, regional filters (MENA, Sub-Saharan Africa, Eastern Europe/Eurasia, South/Southeast Asia, Latin America, North America/Europe), and conflict status filters.
- **Hover Inspection & Country Selection**: Real-time cursor-following tooltip cards with instantaneous metrics; clicking opens the deep country observatory.

### B. Country Historical Observatory (`src/components/CountryDetailModal.tsx`)
- **Dual-Axis Synchronized Time Series (1995–2024)**:
  - Left Y-Axis: Socio-economic indicator (GDP per Capita, HDI, Inflation %, or Displacement).
  - Right Y-Axis: Armed Conflict Intensity (0–100).
  - Interactive Scrubber: Scrub through historical years to inspect indicator values, fatalities, and critical geopolitical markers (e.g., peace accords, civil war outbreaks, invasions).
- **Correlation & Resilience Statistics**:
  - Pearson correlation coefficient ($r$) between conflict and GDP / HDI.
  - Estimated annual GDP drag per 10-point conflict escalation.
  - Institutional Resilience score (0–100) reflecting governance capacity for post-conflict recovery.

### C. Predictive Forecasting Model (`src/utils/econometricModel.ts`)
- **Autoregressive Distributed Lag (ARDL) Formulation**:
  $$\ln(GDP_t) = \alpha + \gamma \cdot \ln(GDP_{t-1}) - \sum_{i=0}^{1} \beta_i \left(\frac{Conflict_{t-i}}{100}\right) + \lambda \cdot Aid_t + \epsilon_t$$
- **Human Development Dynamic Response**:
  $$HDI_t = HDI_{t-1} + \kappa \cdot \Delta \ln(GDP_t) - \delta \cdot \left(\frac{Conflict_t}{100}\right) \cdot (1 - Resilience) + \nu_t$$
- **What-If Scenario Simulator**:
  - Prospective Conflict Intensity Slider (0 = universal peace to 100 = total war).
  - Forecast Horizon Slider (1 to 10 years, up to 2034).
  - Annual International Reconstruction Aid ($0 to $300/capita/year).
  - Institutional Governance Modifier (0.5x fragile to 1.5x robust).
  - Quick Scenario Presets: *Peace Accord*, *De-escalation (-50%)*, *Status Quo*, *War Escalation*.
- **Model Projections**:
  - Projected GDP per capita and HDI trajectories.
  - Upper and lower **95% statistical confidence intervals** ($\pm 1.96 \cdot \sigma \cdot \sqrt{t}$).
  - **Cumulative Peace Dividend**: Dollar-quantified net per-capita and total national economic dividend ($ Billions) comparing the chosen scenario against the counterfactual status-quo baseline.

### D. Cross-Country Correlation Matrix & Scatter Plot (`src/components/CrossCountryExplorer.tsx`)
- Configurable X-axis and Y-axis comparisons across all tracked nations.
- Real-time Ordinary Least Squares (OLS) linear regression line ($y = mx + b$).
- Dynamically calculated Pearson $r$, coefficient of determination ($R^2$), and slope $\beta$.

---

## 2. Empirical Grounding & Data Sources

1. **Conflict Data**: Uppsala Conflict Data Program (UCDP) Battle-Related Deaths dataset and ACLED political violence records.
2. **Human Development**: United Nations Development Programme (UNDP) Human Development Reports (HDI composite of life expectancy, schooling, and income).
3. **Macroeconomics**: World Bank World Development Indicators (constant 2020 USD GDP per capita, annual growth rate, CPI inflation).
4. **Displacement**: United Nations High Commissioner for Refugees (UNHCR) and Internal Displacement Monitoring Centre (IDMC).

---

## 3. Tech Stack & Implementation Details

- **Framework**: React 19 + TypeScript + Vite.
- **Styling**: Tailwind CSS v4 with dark slate canvas (`#070A0F`, `#0B0F17`, `#0E1522`), hairline dividers, and strict zero-pill typographic discipline.
- **Charts & Cartography**: High-performance bespoke SVG visualizations with sub-pixel rendering, zero external charting bundle overhead, and crosshair interaction.
- **Design Constitution**: Compliant with SaaS Dashboard & Data Observatory specifications (60-30-10 color balance, tabular figures `font-mono tabular-nums`, WCAG AA contrast).
