const fs = require('fs');

// Comprehensive database of all sovereign nations and major territories worldwide
const rawCountries = [
  // Europe
  { id: 'UKR', name: 'Ukraine', region: 'Eastern Europe & Eurasia', flag: '🇺🇦', capital: 'Kyiv', pop: 38.0, lat: 48.38, lng: 31.17, conflict: 92, gdp: 4530, hdi: 0.734, infl: 12.8, disp: 9800, status: 'Active War', res: 64 },
  { id: 'RUS', name: 'Russia', region: 'Eastern Europe & Eurasia', flag: '🇷🇺', capital: 'Moscow', pop: 144.2, lat: 61.52, lng: 105.32, conflict: 85, gdp: 12100, hdi: 0.821, infl: 8.5, disp: 450, status: 'Active War', res: 68 },
  { id: 'BIH', name: 'Bosnia & Herzegovina', region: 'Eastern Europe & Eurasia', flag: '🇧🇦', capital: 'Sarajevo', pop: 3.2, lat: 43.92, lng: 17.68, conflict: 12, gdp: 7850, hdi: 0.780, infl: 3.4, disp: 85, status: 'Post-Conflict Recovery', res: 58 },
  { id: 'GEO', name: 'Georgia', region: 'Eastern Europe & Eurasia', flag: '🇬🇪', capital: 'Tbilisi', pop: 3.7, lat: 42.32, lng: 43.36, conflict: 22, gdp: 8200, hdi: 0.814, infl: 2.5, disp: 290, status: 'Post-Conflict Recovery', res: 70 },
  { id: 'ARM', name: 'Armenia', region: 'Eastern Europe & Eurasia', flag: '🇦🇲', capital: 'Yerevan', pop: 2.8, lat: 40.07, lng: 45.04, conflict: 38, gdp: 8100, hdi: 0.786, infl: 2.0, disp: 120, status: 'Protracted Insurgency', res: 62 },
  { id: 'AZE', name: 'Azerbaijan', region: 'Eastern Europe & Eurasia', flag: '🇦🇿', capital: 'Baku', pop: 10.4, lat: 40.14, lng: 47.58, conflict: 42, gdp: 7200, hdi: 0.760, infl: 4.8, disp: 650, status: 'Protracted Insurgency', res: 60 },
  { id: 'MDA', name: 'Moldova', region: 'Eastern Europe & Eurasia', flag: '🇲🇩', capital: 'Chisinau', pop: 2.5, lat: 47.41, lng: 28.37, conflict: 20, gdp: 5600, hdi: 0.763, infl: 4.2, disp: 90, status: 'Stable / Benchmark', res: 62 },
  { id: 'BLR', name: 'Belarus', region: 'Eastern Europe & Eurasia', flag: '🇧🇾', capital: 'Minsk', pop: 9.2, lat: 53.71, lng: 27.95, conflict: 35, gdp: 7900, hdi: 0.801, infl: 5.6, disp: 15, status: 'Stable / Benchmark', res: 55 },
  { id: 'DEU', name: 'Germany', region: 'North America & Europe', flag: '🇩🇪', capital: 'Berlin', pop: 84.4, lat: 51.17, lng: 10.45, conflict: 3, gdp: 52800, hdi: 0.950, infl: 2.4, disp: 0, status: 'Stable / Benchmark', res: 94 },
  { id: 'GBR', name: 'United Kingdom', region: 'North America & Europe', flag: '🇬🇧', capital: 'London', pop: 67.7, lat: 55.38, lng: -3.44, conflict: 4, gdp: 48900, hdi: 0.940, infl: 2.6, disp: 0, status: 'Stable / Benchmark', res: 92 },
  { id: 'FRA', name: 'France', region: 'North America & Europe', flag: '🇫🇷', capital: 'Paris', pop: 68.0, lat: 46.23, lng: 2.21, conflict: 4, gdp: 45200, hdi: 0.910, infl: 2.2, disp: 0, status: 'Stable / Benchmark', res: 90 },
  { id: 'NOR', name: 'Norway', region: 'North America & Europe', flag: '🇳🇴', capital: 'Oslo', pop: 5.5, lat: 60.47, lng: 8.47, conflict: 2, gdp: 88500, hdi: 0.966, infl: 3.1, disp: 0, status: 'Stable / Benchmark', res: 98 },
  { id: 'SWE', name: 'Sweden', region: 'North America & Europe', flag: '🇸🇪', capital: 'Stockholm', pop: 10.5, lat: 60.13, lng: 18.64, conflict: 3, gdp: 56400, hdi: 0.952, infl: 2.8, disp: 0, status: 'Stable / Benchmark', res: 96 },
  { id: 'FIN', name: 'Finland', region: 'North America & Europe', flag: '🇫🇮', capital: 'Helsinki', pop: 5.6, lat: 61.92, lng: 25.75, conflict: 2, gdp: 53800, hdi: 0.942, infl: 2.0, disp: 0, status: 'Stable / Benchmark', res: 97 },
  { id: 'CHE', name: 'Switzerland', region: 'North America & Europe', flag: '🇨🇭', capital: 'Bern', pop: 8.9, lat: 46.82, lng: 8.23, conflict: 1, gdp: 92400, hdi: 0.967, infl: 1.3, disp: 0, status: 'Stable / Benchmark', res: 99 },
  { id: 'POL', name: 'Poland', region: 'Eastern Europe & Eurasia', flag: '🇵🇱', capital: 'Warsaw', pop: 37.8, lat: 51.92, lng: 19.15, conflict: 6, gdp: 21800, hdi: 0.881, infl: 3.9, disp: 0, status: 'Stable / Benchmark', res: 84 },
  { id: 'ITA', name: 'Italy', region: 'North America & Europe', flag: '🇮🇹', capital: 'Rome', pop: 58.9, lat: 41.87, lng: 12.57, conflict: 3, gdp: 38200, hdi: 0.906, infl: 1.8, disp: 0, status: 'Stable / Benchmark', res: 86 },
  { id: 'ESP', name: 'Spain', region: 'North America & Europe', flag: '🇪🇸', capital: 'Madrid', pop: 48.1, lat: 40.46, lng: -3.75, conflict: 4, gdp: 32900, hdi: 0.911, infl: 2.8, disp: 0, status: 'Stable / Benchmark', res: 88 },
  { id: 'NLD', name: 'Netherlands', region: 'North America & Europe', flag: '🇳🇱', capital: 'Amsterdam', pop: 17.9, lat: 52.13, lng: 5.29, conflict: 2, gdp: 61200, hdi: 0.946, infl: 2.7, disp: 0, status: 'Stable / Benchmark', res: 95 },
  { id: 'BEL', name: 'Belgium', region: 'North America & Europe', flag: '🇧🇪', capital: 'Brussels', pop: 11.7, lat: 50.50, lng: 4.47, conflict: 3, gdp: 53100, hdi: 0.942, infl: 3.2, disp: 0, status: 'Stable / Benchmark', res: 91 },
  { id: 'GRC', name: 'Greece', region: 'North America & Europe', flag: '🇬🇷', capital: 'Athens', pop: 10.4, lat: 39.07, lng: 21.82, conflict: 5, gdp: 23400, hdi: 0.893, infl: 3.0, disp: 0, status: 'Stable / Benchmark', res: 80 },
  { id: 'PRT', name: 'Portugal', region: 'North America & Europe', flag: '🇵🇹', capital: 'Lisbon', pop: 10.3, lat: 39.40, lng: -8.22, conflict: 2, gdp: 27800, hdi: 0.874, infl: 2.5, disp: 0, status: 'Stable / Benchmark', res: 87 },
  { id: 'IRL', name: 'Ireland', region: 'North America & Europe', flag: '🇮🇪', capital: 'Dublin', pop: 5.2, lat: 53.41, lng: -8.24, conflict: 3, gdp: 104200, hdi: 0.950, infl: 2.2, disp: 0, status: 'Stable / Benchmark', res: 93 },
  { id: 'AUT', name: 'Austria', region: 'North America & Europe', flag: '🇦🇹', capital: 'Vienna', pop: 9.1, lat: 47.52, lng: 14.55, conflict: 2, gdp: 56800, hdi: 0.926, infl: 3.4, disp: 0, status: 'Stable / Benchmark', res: 94 },
  { id: 'CZE', name: 'Czechia', region: 'Eastern Europe & Eurasia', flag: '🇨🇿', capital: 'Prague', pop: 10.8, lat: 49.82, lng: 15.47, conflict: 3, gdp: 31200, hdi: 0.895, infl: 2.6, disp: 0, status: 'Stable / Benchmark', res: 88 },
  { id: 'ROU', name: 'Romania', region: 'Eastern Europe & Eurasia', flag: '🇷🇴', capital: 'Bucharest', pop: 19.1, lat: 45.94, lng: 24.97, conflict: 4, gdp: 18400, hdi: 0.828, infl: 5.4, disp: 0, status: 'Stable / Benchmark', res: 78 },
  { id: 'HUN', name: 'Hungary', region: 'Eastern Europe & Eurasia', flag: '🇭🇺', capital: 'Budapest', pop: 9.6, lat: 47.16, lng: 19.50, conflict: 5, gdp: 21500, hdi: 0.851, infl: 4.1, disp: 0, status: 'Stable / Benchmark', res: 79 },
  { id: 'SRB', name: 'Serbia', region: 'Eastern Europe & Eurasia', flag: '🇷🇸', capital: 'Belgrade', pop: 6.6, lat: 44.02, lng: 21.01, conflict: 18, gdp: 11400, hdi: 0.805, infl: 4.6, disp: 200, status: 'Post-Conflict Recovery', res: 68 },
  { id: 'HRV', name: 'Croatia', region: 'Eastern Europe & Eurasia', flag: '🇭🇷', capital: 'Zagreb', pop: 3.9, lat: 45.10, lng: 15.20, conflict: 5, gdp: 21400, hdi: 0.867, infl: 3.8, disp: 10, status: 'Post-Conflict Recovery', res: 82 },
  { id: 'ALB', name: 'Albania', region: 'Eastern Europe & Eurasia', flag: '🇦🇱', capital: 'Tirana', pop: 2.7, lat: 41.15, lng: 20.17, conflict: 8, gdp: 8900, hdi: 0.789, infl: 2.2, disp: 0, status: 'Post-Conflict Recovery', res: 65 },
  { id: 'KOS', name: 'Kosovo', region: 'Eastern Europe & Eurasia', flag: '🇽🇰', capital: 'Pristina', pop: 1.8, lat: 42.60, lng: 20.90, conflict: 24, gdp: 5900, hdi: 0.742, infl: 3.1, disp: 15, status: 'Post-Conflict Recovery', res: 56 },

  // Middle East & North Africa
  { id: 'SYR', name: 'Syria', region: 'Middle East & North Africa', flag: '🇸🇾', capital: 'Damascus', pop: 22.1, lat: 34.80, lng: 39.00, conflict: 84, gdp: 1240, hdi: 0.557, infl: 78.4, disp: 12500, status: 'Protracted Insurgency', res: 22 },
  { id: 'YEM', name: 'Yemen', region: 'Middle East & North Africa', flag: '🇾🇪', capital: 'Sanaa', pop: 33.7, lat: 15.55, lng: 48.52, conflict: 82, gdp: 680, hdi: 0.424, infl: 32.5, disp: 4500, status: 'Active War', res: 20 },
  { id: 'IRQ', name: 'Iraq', region: 'Middle East & North Africa', flag: '🇮🇶', capital: 'Baghdad', pop: 44.5, lat: 33.22, lng: 43.68, conflict: 44, gdp: 5820, hdi: 0.673, infl: 4.8, disp: 1200, status: 'Protracted Insurgency', res: 46 },
  { id: 'LBN', name: 'Lebanon', region: 'Middle East & North Africa', flag: '🇱🇧', capital: 'Beirut', pop: 5.4, lat: 33.85, lng: 35.86, conflict: 76, gdp: 4100, hdi: 0.723, infl: 84.0, disp: 1200, status: 'Active War', res: 40 },
  { id: 'PSE', name: 'Palestine', region: 'Middle East & North Africa', flag: '🇵🇸', capital: 'Ramallah', pop: 5.3, lat: 31.95, lng: 35.23, conflict: 96, gdp: 2800, hdi: 0.690, infl: 28.0, disp: 2300, status: 'Active War', res: 25 },
  { id: 'ISR', name: 'Israel', region: 'Middle East & North Africa', flag: '🇮🇱', capital: 'Jerusalem', pop: 9.8, lat: 31.05, lng: 34.85, conflict: 82, gdp: 53200, hdi: 0.915, infl: 3.2, disp: 200, status: 'Active War', res: 86 },
  { id: 'LBY', name: 'Libya', region: 'Middle East & North Africa', flag: '🇱🇾', capital: 'Tripoli', pop: 6.9, lat: 26.34, lng: 17.23, conflict: 55, gdp: 6850, hdi: 0.718, infl: 3.2, disp: 280, status: 'Protracted Insurgency', res: 32 },
  { id: 'EGY', name: 'Egypt', region: 'Middle East & North Africa', flag: '🇪🇬', capital: 'Cairo', pop: 112.7, lat: 26.82, lng: 30.80, conflict: 32, gdp: 3750, hdi: 0.731, infl: 35.7, disp: 900, status: 'Protracted Insurgency', res: 55 },
  { id: 'IRN', name: 'Iran', region: 'Middle East & North Africa', flag: '🇮🇷', capital: 'Tehran', pop: 88.6, lat: 32.43, lng: 53.68, conflict: 52, gdp: 4680, hdi: 0.780, infl: 39.5, disp: 350, status: 'Protracted Insurgency', res: 58 },
  { id: 'TUR', name: 'Turkey', region: 'Middle East & North Africa', flag: '🇹🇷', capital: 'Ankara', pop: 85.3, lat: 38.96, lng: 35.24, conflict: 40, gdp: 13400, hdi: 0.855, infl: 52.0, disp: 3600, status: 'Protracted Insurgency', res: 72 },
  { id: 'SAU', name: 'Saudi Arabia', region: 'Middle East & North Africa', flag: '🇸🇦', capital: 'Riyadh', pop: 36.4, lat: 23.89, lng: 45.08, conflict: 14, gdp: 32500, hdi: 0.875, infl: 1.6, disp: 0, status: 'Stable / Benchmark', res: 78 },
  { id: 'ARE', name: 'United Arab Emirates', region: 'Middle East & North Africa', flag: '🇦🇪', capital: 'Abu Dhabi', pop: 9.5, lat: 23.42, lng: 53.85, conflict: 8, gdp: 52400, hdi: 0.937, infl: 2.1, disp: 0, status: 'Stable / Benchmark', res: 89 },
  { id: 'JOR', name: 'Jordan', region: 'Middle East & North Africa', flag: '🇯🇴', capital: 'Amman', pop: 11.3, lat: 30.59, lng: 36.24, conflict: 16, gdp: 4500, hdi: 0.736, infl: 1.8, disp: 720, status: 'Stable / Benchmark', res: 68 },
  { id: 'MAR', name: 'Morocco', region: 'Middle East & North Africa', flag: '🇲🇦', capital: 'Rabat', pop: 37.8, lat: 31.79, lng: -7.09, conflict: 15, gdp: 3950, hdi: 0.698, infl: 1.4, disp: 20, status: 'Stable / Benchmark', res: 72 },
  { id: 'DZA', name: 'Algeria', region: 'Middle East & North Africa', flag: '🇩🇿', capital: 'Algiers', pop: 45.6, lat: 28.03, lng: 1.66, conflict: 20, gdp: 4800, hdi: 0.745, infl: 7.8, disp: 100, status: 'Post-Conflict Recovery', res: 62 },
  { id: 'TUN', name: 'Tunisia', region: 'Middle East & North Africa', flag: '🇹🇳', capital: 'Tunis', pop: 12.4, lat: 33.89, lng: 9.54, conflict: 18, gdp: 4120, hdi: 0.732, infl: 7.2, disp: 10, status: 'Stable / Benchmark', res: 60 },
  { id: 'QAT', name: 'Qatar', region: 'Middle East & North Africa', flag: '🇶🇦', capital: 'Doha', pop: 2.7, lat: 25.35, lng: 51.18, conflict: 4, gdp: 82800, hdi: 0.875, infl: 1.2, disp: 0, status: 'Stable / Benchmark', res: 90 },
  { id: 'OMN', name: 'Oman', region: 'Middle East & North Africa', flag: '🇴🇲', capital: 'Muscat', pop: 4.6, lat: 21.51, lng: 55.92, conflict: 6, gdp: 21200, hdi: 0.816, infl: 1.0, disp: 0, status: 'Stable / Benchmark', res: 80 },
  { id: 'KWT', name: 'Kuwait', region: 'Middle East & North Africa', flag: '🇰🇼', capital: 'Kuwait City', pop: 4.3, lat: 29.31, lng: 47.48, conflict: 5, gdp: 33900, hdi: 0.847, infl: 3.1, disp: 0, status: 'Stable / Benchmark', res: 82 },
  { id: 'BHR', name: 'Bahrain', region: 'Middle East & North Africa', flag: '🇧🇭', capital: 'Manama', pop: 1.5, lat: 26.07, lng: 50.56, conflict: 8, gdp: 28400, hdi: 0.888, infl: 1.4, disp: 0, status: 'Stable / Benchmark', res: 78 },

  // Sub-Saharan Africa
  { id: 'SDN', name: 'Sudan', region: 'Sub-Saharan Africa', flag: '🇸🇩', capital: 'Khartoum', pop: 48.1, lat: 12.86, lng: 30.22, conflict: 95, gdp: 750, hdi: 0.508, infl: 145.0, disp: 10400, status: 'Active War', res: 25 },
  { id: 'SSD', name: 'South Sudan', region: 'Sub-Saharan Africa', flag: '🇸🇸', capital: 'Juba', pop: 11.1, lat: 6.88, lng: 31.31, conflict: 88, gdp: 460, hdi: 0.381, infl: 54.0, disp: 4100, status: 'Active War', res: 18 },
  { id: 'COD', name: 'DR Congo', region: 'Sub-Saharan Africa', flag: '🇨🇩', capital: 'Kinshasa', pop: 102.3, lat: -4.04, lng: 21.76, conflict: 86, gdp: 660, hdi: 0.481, infl: 21.0, disp: 7200, status: 'Active War', res: 28 },
  { id: 'SOM', name: 'Somalia', region: 'Sub-Saharan Africa', flag: '🇸🇴', capital: 'Mogadishu', pop: 18.1, lat: 5.15, lng: 46.20, conflict: 85, gdp: 620, hdi: 0.380, infl: 6.5, disp: 3900, status: 'Protracted Insurgency', res: 24 },
  { id: 'MLI', name: 'Mali', region: 'Sub-Saharan Africa', flag: '🇲🇱', capital: 'Bamako', pop: 23.2, lat: 17.57, lng: -4.00, conflict: 80, gdp: 890, hdi: 0.428, infl: 4.2, disp: 420, status: 'Protracted Insurgency', res: 30 },
  { id: 'BFA', name: 'Burkina Faso', region: 'Sub-Saharan Africa', flag: '🇧🇫', capital: 'Ouagadougou', pop: 22.7, lat: 12.24, lng: -1.56, conflict: 82, gdp: 860, hdi: 0.449, infl: 2.8, disp: 2100, status: 'Protracted Insurgency', res: 28 },
  { id: 'NER', name: 'Niger', region: 'Sub-Saharan Africa', flag: '🇳🇪', capital: 'Niamey', pop: 25.3, lat: 17.61, lng: 8.08, conflict: 72, gdp: 590, hdi: 0.400, infl: 4.0, disp: 710, status: 'Protracted Insurgency', res: 26 },
  { id: 'NGA', name: 'Nigeria', region: 'Sub-Saharan Africa', flag: '🇳🇬', capital: 'Abuja', pop: 224.0, lat: 9.08, lng: 8.68, conflict: 74, gdp: 1850, hdi: 0.535, infl: 32.1, disp: 3600, status: 'Protracted Insurgency', res: 48 },
  { id: 'ETH', name: 'Ethiopia', region: 'Sub-Saharan Africa', flag: '🇪🇹', capital: 'Addis Ababa', pop: 126.5, lat: 9.15, lng: 40.49, conflict: 71, gdp: 1120, hdi: 0.498, infl: 26.8, disp: 4400, status: 'Protracted Insurgency', res: 44 },
  { id: 'MOZ', name: 'Mozambique', region: 'Sub-Saharan Africa', flag: '🇲🇿', capital: 'Maputo', pop: 33.9, lat: -18.67, lng: 35.53, conflict: 64, gdp: 560, hdi: 0.461, infl: 4.5, disp: 1000, status: 'Protracted Insurgency', res: 36 },
  { id: 'CAF', name: 'Central African Republic', region: 'Sub-Saharan Africa', flag: '🇨🇫', capital: 'Bangui', pop: 5.6, lat: 6.61, lng: 20.94, conflict: 78, gdp: 510, hdi: 0.387, infl: 3.5, disp: 1200, status: 'Protracted Insurgency', res: 22 },
  { id: 'TCD', name: 'Chad', region: 'Sub-Saharan Africa', flag: '🇹🇩', capital: 'N\'Djamena', pop: 18.3, lat: 15.45, lng: 18.73, conflict: 62, gdp: 720, hdi: 0.394, infl: 4.6, disp: 1100, status: 'Protracted Insurgency', res: 30 },
  { id: 'CMR', name: 'Cameroon', region: 'Sub-Saharan Africa', flag: '🇨🇲', capital: 'Yaounde', pop: 28.6, lat: 7.37, lng: 12.35, conflict: 60, gdp: 1680, hdi: 0.587, infl: 5.8, disp: 1100, status: 'Protracted Insurgency', res: 42 },
  { id: 'RWA', name: 'Rwanda', region: 'Sub-Saharan Africa', flag: '🇷🇼', capital: 'Kigali', pop: 14.1, lat: -1.94, lng: 29.87, conflict: 18, gdp: 1040, hdi: 0.548, infl: 7.2, disp: 130, status: 'Post-Conflict Recovery', res: 78 },
  { id: 'SLE', name: 'Sierra Leone', region: 'Sub-Saharan Africa', flag: '🇸🇱', capital: 'Freetown', pop: 8.8, lat: 8.46, lng: -11.78, conflict: 14, gdp: 520, hdi: 0.458, infl: 45.0, disp: 10, status: 'Post-Conflict Recovery', res: 50 },
  { id: 'LBR', name: 'Liberia', region: 'Sub-Saharan Africa', flag: '🇱🇷', capital: 'Monrovia', pop: 5.4, lat: 6.43, lng: -9.43, conflict: 15, gdp: 750, hdi: 0.487, infl: 10.1, disp: 5, status: 'Post-Conflict Recovery', res: 52 },
  { id: 'AGO', name: 'Angola', region: 'Sub-Saharan Africa', flag: '🇦🇴', capital: 'Luanda', pop: 36.7, lat: -11.20, lng: 17.87, conflict: 16, gdp: 2980, hdi: 0.591, infl: 20.0, disp: 60, status: 'Post-Conflict Recovery', res: 55 },
  { id: 'GHA', name: 'Ghana', region: 'Sub-Saharan Africa', flag: '🇬🇭', capital: 'Accra', pop: 34.1, lat: 7.95, lng: -1.02, conflict: 8, gdp: 2280, hdi: 0.632, infl: 23.2, disp: 12, status: 'Stable / Benchmark', res: 74 },
  { id: 'ZAF', name: 'South Africa', region: 'Sub-Saharan Africa', flag: '🇿🇦', capital: 'Pretoria', pop: 60.4, lat: -30.56, lng: 22.94, conflict: 25, gdp: 6180, hdi: 0.717, infl: 5.2, disp: 250, status: 'Stable / Benchmark', res: 75 },
  { id: 'KEN', name: 'Kenya', region: 'Sub-Saharan Africa', flag: '🇰🇪', capital: 'Nairobi', pop: 55.1, lat: -0.02, lng: 37.91, conflict: 24, gdp: 2150, hdi: 0.601, infl: 6.8, disp: 750, status: 'Stable / Benchmark', res: 68 },
  { id: 'UGA', name: 'Uganda', region: 'Sub-Saharan Africa', flag: '🇺🇬', capital: 'Kampala', pop: 48.6, lat: 1.37, lng: 32.29, conflict: 28, gdp: 1020, hdi: 0.550, infl: 3.5, disp: 1600, status: 'Post-Conflict Recovery', res: 60 },
  { id: 'TZA', name: 'Tanzania', region: 'Sub-Saharan Africa', flag: '🇹🇿', capital: 'Dodoma', pop: 65.5, lat: -6.37, lng: 34.89, conflict: 12, gdp: 1250, hdi: 0.549, infl: 3.1, disp: 240, status: 'Stable / Benchmark', res: 70 },
  { id: 'SEN', name: 'Senegal', region: 'Sub-Saharan Africa', flag: '🇸🇳', capital: 'Dakar', pop: 17.7, lat: 14.50, lng: -14.45, conflict: 15, gdp: 1650, hdi: 0.517, infl: 2.1, disp: 25, status: 'Stable / Benchmark', res: 71 },
  { id: 'CIV', name: 'Ivory Coast', region: 'Sub-Saharan Africa', flag: '🇨🇮', capital: 'Yamoussoukro', pop: 29.4, lat: 7.54, lng: -5.55, conflict: 16, gdp: 2720, hdi: 0.550, infl: 4.4, disp: 30, status: 'Post-Conflict Recovery', res: 66 },
  { id: 'ZMB', name: 'Zambia', region: 'Sub-Saharan Africa', flag: '🇿🇲', capital: 'Lusaka', pop: 20.6, lat: -13.13, lng: 27.85, conflict: 10, gdp: 1420, hdi: 0.565, infl: 13.8, disp: 100, status: 'Stable / Benchmark', res: 64 },
  { id: 'ZWE', name: 'Zimbabwe', region: 'Sub-Saharan Africa', flag: '🇿🇼', capital: 'Harare', pop: 16.3, lat: -19.02, lng: 29.15, conflict: 28, gdp: 1750, hdi: 0.550, infl: 55.0, disp: 50, status: 'Stable / Benchmark', res: 45 },
  { id: 'BWA', name: 'Botswana', region: 'Sub-Saharan Africa', flag: '🇧🇼', capital: 'Gaborone', pop: 2.6, lat: -22.33, lng: 24.68, conflict: 4, gdp: 7600, hdi: 0.708, infl: 3.2, disp: 0, status: 'Stable / Benchmark', res: 84 },
  { id: 'NAM', name: 'Namibia', region: 'Sub-Saharan Africa', flag: '🇳🇦', capital: 'Windhoek', pop: 2.6, lat: -22.96, lng: 18.49, conflict: 5, gdp: 4900, hdi: 0.610, infl: 4.5, disp: 0, status: 'Stable / Benchmark', res: 78 },
  { id: 'MDG', name: 'Madagascar', region: 'Sub-Saharan Africa', flag: '🇲🇬', capital: 'Antananarivo', pop: 29.6, lat: -18.77, lng: 46.87, conflict: 15, gdp: 530, hdi: 0.487, infl: 7.5, disp: 10, status: 'Stable / Benchmark', res: 50 },
  { id: 'GIN', name: 'Guinea', region: 'Sub-Saharan Africa', flag: '🇬🇳', capital: 'Conakry', pop: 14.2, lat: 9.95, lng: -9.70, conflict: 35, gdp: 1540, hdi: 0.471, infl: 8.0, disp: 15, status: 'Protracted Insurgency', res: 46 },
  { id: 'BEN', name: 'Benin', region: 'Sub-Saharan Africa', flag: '🇧🇯', capital: 'Porto-Novo', pop: 13.7, lat: 9.31, lng: 2.32, conflict: 28, gdp: 1440, hdi: 0.504, infl: 2.7, disp: 12, status: 'Stable / Benchmark', res: 62 },
  { id: 'TGO', name: 'Togo', region: 'Sub-Saharan Africa', flag: '🇹🇬', capital: 'Lome', pop: 9.1, lat: 8.62, lng: 0.82, conflict: 32, gdp: 1010, hdi: 0.547, infl: 3.2, disp: 10, status: 'Stable / Benchmark', res: 55 },
  { id: 'BDI', name: 'Burundi', region: 'Sub-Saharan Africa', flag: '🇧🇮', capital: 'Gitega', pop: 13.2, lat: -3.37, lng: 29.92, conflict: 45, gdp: 240, hdi: 0.420, infl: 26.0, disp: 320, status: 'Protracted Insurgency', res: 34 },
  { id: 'ERI', name: 'Eritrea', region: 'Sub-Saharan Africa', flag: '🇪🇷', capital: 'Asmara', pop: 3.7, lat: 15.18, lng: 39.78, conflict: 58, gdp: 650, hdi: 0.492, infl: 12.0, disp: 580, status: 'Protracted Insurgency', res: 28 },
  { id: 'MRT', name: 'Mauritania', region: 'Sub-Saharan Africa', flag: '🇲🇷', capital: 'Nouakchott', pop: 4.7, lat: 21.01, lng: -10.94, conflict: 20, gdp: 2180, hdi: 0.540, infl: 4.8, disp: 110, status: 'Stable / Benchmark', res: 54 },
  { id: 'GMB', name: 'Gambia', region: 'Sub-Saharan Africa', flag: '🇬🇲', capital: 'Banjul', pop: 2.7, lat: 13.44, lng: -15.31, conflict: 8, gdp: 840, hdi: 0.495, infl: 16.5, disp: 0, status: 'Stable / Benchmark', res: 60 },
  { id: 'GAB', name: 'Gabon', region: 'Sub-Saharan Africa', flag: '🇬🇦', capital: 'Libreville', pop: 2.4, lat: -0.80, lng: 11.61, conflict: 22, gdp: 8820, hdi: 0.693, infl: 3.6, disp: 0, status: 'Stable / Benchmark', res: 65 },
  { id: 'COG', name: 'Republic of the Congo', region: 'Sub-Saharan Africa', flag: '🇨🇬', capital: 'Brazzaville', pop: 6.1, lat: -0.23, lng: 15.83, conflict: 25, gdp: 2450, hdi: 0.593, infl: 3.8, disp: 25, status: 'Post-Conflict Recovery', res: 50 },

  // South & Southeast Asia & East Asia
  { id: 'AFG', name: 'Afghanistan', region: 'South & Southeast Asia', flag: '🇦🇫', capital: 'Kabul', pop: 42.2, lat: 33.94, lng: 67.71, conflict: 62, gdp: 480, hdi: 0.462, infl: -8.5, disp: 6100, status: 'Protracted Insurgency', res: 28 },
  { id: 'MMR', name: 'Myanmar', region: 'South & Southeast Asia', flag: '🇲🇲', capital: 'Naypyidaw', pop: 54.5, lat: 21.92, lng: 95.96, conflict: 90, gdp: 1180, hdi: 0.585, infl: 28.5, disp: 3100, status: 'Active War', res: 32 },
  { id: 'PAK', name: 'Pakistan', region: 'South & Southeast Asia', flag: '🇵🇰', capital: 'Islamabad', pop: 241.5, lat: 30.38, lng: 69.35, conflict: 64, gdp: 1590, hdi: 0.544, infl: 23.4, disp: 1800, status: 'Protracted Insurgency', res: 52 },
  { id: 'IND', name: 'India', region: 'South & Southeast Asia', flag: '🇮🇳', capital: 'New Delhi', pop: 1428.0, lat: 20.59, lng: 78.96, conflict: 28, gdp: 2610, hdi: 0.644, infl: 5.1, disp: 450, status: 'Stable / Benchmark', res: 76 },
  { id: 'BGD', name: 'Bangladesh', region: 'South & Southeast Asia', flag: '🇧🇩', capital: 'Dhaka', pop: 173.0, lat: 23.68, lng: 90.36, conflict: 32, gdp: 2680, hdi: 0.670, infl: 9.7, disp: 980, status: 'Protracted Insurgency', res: 62 },
  { id: 'LKA', name: 'Sri Lanka', region: 'South & Southeast Asia', flag: '🇱🇰', capital: 'Colombo', pop: 22.2, lat: 7.87, lng: 80.77, conflict: 18, gdp: 3850, hdi: 0.780, infl: 5.9, disp: 80, status: 'Post-Conflict Recovery', res: 68 },
  { id: 'NPL', name: 'Nepal', region: 'South & Southeast Asia', flag: '🇳🇵', capital: 'Kathmandu', pop: 30.9, lat: 28.39, lng: 84.12, conflict: 15, gdp: 1380, hdi: 0.601, infl: 6.2, disp: 20, status: 'Post-Conflict Recovery', res: 64 },
  { id: 'PHL', name: 'Philippines', region: 'South & Southeast Asia', flag: '🇵🇭', capital: 'Manila', pop: 117.3, lat: 12.88, lng: 121.77, conflict: 42, gdp: 3900, hdi: 0.710, infl: 3.7, disp: 310, status: 'Protracted Insurgency', res: 66 },
  { id: 'IDN', name: 'Indonesia', region: 'South & Southeast Asia', flag: '🇮🇩', capital: 'Jakarta', pop: 277.5, lat: -0.79, lng: 113.92, conflict: 22, gdp: 4940, hdi: 0.713, infl: 2.8, disp: 90, status: 'Stable / Benchmark', res: 74 },
  { id: 'VNM', name: 'Vietnam', region: 'South & Southeast Asia', flag: '🇻🇳', capital: 'Hanoi', pop: 98.9, lat: 14.06, lng: 108.28, conflict: 6, gdp: 4350, hdi: 0.726, infl: 3.8, disp: 0, status: 'Post-Conflict Recovery', res: 80 },
  { id: 'THA', name: 'Thailand', region: 'South & Southeast Asia', flag: '🇹🇭', capital: 'Bangkok', pop: 71.8, lat: 15.87, lng: 100.99, conflict: 26, gdp: 7810, hdi: 0.803, infl: 0.8, disp: 85, status: 'Protracted Insurgency', res: 76 },
  { id: 'MYS', name: 'Malaysia', region: 'South & Southeast Asia', flag: '🇲🇾', capital: 'Kuala Lumpur', pop: 34.3, lat: 4.21, lng: 101.98, conflict: 8, gdp: 13100, hdi: 0.807, infl: 1.8, disp: 0, status: 'Stable / Benchmark', res: 82 },
  { id: 'KHM', name: 'Cambodia', region: 'South & Southeast Asia', flag: '🇰🇭', capital: 'Phnom Penh', pop: 16.9, lat: 12.57, lng: 104.99, conflict: 12, gdp: 1920, hdi: 0.600, infl: 2.5, disp: 10, status: 'Post-Conflict Recovery', res: 62 },
  { id: 'LAO', name: 'Laos', region: 'South & Southeast Asia', flag: '🇱🇦', capital: 'Vientiane', pop: 7.6, lat: 19.86, lng: 102.50, conflict: 10, gdp: 2050, hdi: 0.620, infl: 25.0, disp: 0, status: 'Stable / Benchmark', res: 58 },
  { id: 'JPN', name: 'Japan', region: 'South & Southeast Asia', flag: '🇯🇵', capital: 'Tokyo', pop: 124.5, lat: 36.20, lng: 138.25, conflict: 3, gdp: 34100, hdi: 0.920, infl: 2.8, disp: 0, status: 'Stable / Benchmark', res: 95 },
  { id: 'KOR', name: 'South Korea', region: 'South & Southeast Asia', flag: '🇰🇷', capital: 'Seoul', pop: 51.7, lat: 35.91, lng: 127.77, conflict: 14, gdp: 33100, hdi: 0.929, infl: 2.6, disp: 0, status: 'Stable / Benchmark', res: 94 },
  { id: 'CHN', name: 'China', region: 'South & Southeast Asia', flag: '🇨🇳', capital: 'Beijing', pop: 1411.0, lat: 35.86, lng: 104.20, conflict: 18, gdp: 12720, hdi: 0.788, infl: 0.3, disp: 0, status: 'Stable / Benchmark', res: 88 },
  { id: 'TWN', name: 'Taiwan', region: 'South & Southeast Asia', flag: '🇹🇼', capital: 'Taipei', pop: 23.9, lat: 23.70, lng: 120.96, conflict: 22, gdp: 34200, hdi: 0.926, infl: 2.1, disp: 0, status: 'Stable / Benchmark', res: 92 },
  { id: 'PRK', name: 'North Korea', region: 'South & Southeast Asia', flag: '🇰🇵', capital: 'Pyongyang', pop: 26.1, lat: 40.34, lng: 127.51, conflict: 48, gdp: 680, hdi: 0.520, infl: 10.0, disp: 0, status: 'Stable / Benchmark', res: 40 },
  { id: 'SGP', name: 'Singapore', region: 'South & Southeast Asia', flag: '🇸🇬', capital: 'Singapore', pop: 5.9, lat: 1.35, lng: 103.82, conflict: 1, gdp: 84700, hdi: 0.949, infl: 2.4, disp: 0, status: 'Stable / Benchmark', res: 99 },
  { id: 'TLS', name: 'Timor-Leste', region: 'South & Southeast Asia', flag: '🇹🇱', capital: 'Dili', pop: 1.4, lat: -8.87, lng: 125.73, conflict: 12, gdp: 1450, hdi: 0.666, infl: 5.8, disp: 5, status: 'Post-Conflict Recovery', res: 62 },
  { id: 'MNG', name: 'Mongolia', region: 'South & Southeast Asia', flag: '🇲🇳', capital: 'Ulaanbaatar', pop: 3.4, lat: 46.86, lng: 103.85, conflict: 4, gdp: 5300, hdi: 0.741, infl: 8.5, disp: 0, status: 'Stable / Benchmark', res: 75 },
  { id: 'KAZ', name: 'Kazakhstan', region: 'Eastern Europe & Eurasia', flag: '🇰🇿', capital: 'Astana', pop: 20.0, lat: 48.02, lng: 66.92, conflict: 14, gdp: 13200, hdi: 0.802, infl: 8.4, disp: 0, status: 'Stable / Benchmark', res: 74 },
  { id: 'UZB', name: 'Uzbekistan', region: 'Eastern Europe & Eurasia', flag: '🇺🇿', capital: 'Tashkent', pop: 36.4, lat: 41.38, lng: 64.59, conflict: 12, gdp: 2500, hdi: 0.727, infl: 9.8, disp: 0, status: 'Stable / Benchmark', res: 68 },
  { id: 'TKM', name: 'Turkmenistan', region: 'Eastern Europe & Eurasia', flag: '🇹🇲', capital: 'Ashgabat', pop: 6.5, lat: 38.97, lng: 59.56, conflict: 8, gdp: 7800, hdi: 0.744, infl: 6.2, disp: 0, status: 'Stable / Benchmark', res: 50 },
  { id: 'KGZ', name: 'Kyrgyzstan', region: 'Eastern Europe & Eurasia', flag: '🇰🇬', capital: 'Bishkek', pop: 7.0, lat: 41.20, lng: 74.77, conflict: 24, gdp: 1740, hdi: 0.701, infl: 7.3, disp: 20, status: 'Stable / Benchmark', res: 58 },
  { id: 'TJK', name: 'Tajikistan', region: 'Eastern Europe & Eurasia', flag: '🇹🇯', capital: 'Dushanbe', pop: 10.1, lat: 38.86, lng: 71.28, conflict: 28, gdp: 1180, hdi: 0.679, infl: 4.5, disp: 25, status: 'Post-Conflict Recovery', res: 52 },

  // Latin America & Caribbean
  { id: 'COL', name: 'Colombia', region: 'Latin America & Caribbean', flag: '🇨🇴', capital: 'Bogota', pop: 52.1, lat: 4.57, lng: -74.30, conflict: 48, gdp: 6980, hdi: 0.758, infl: 7.2, disp: 5100, status: 'Protracted Insurgency', res: 68 },
  { id: 'MEX', name: 'Mexico', region: 'Latin America & Caribbean', flag: '🇲🇽', capital: 'Mexico City', pop: 128.5, lat: 23.63, lng: -102.55, conflict: 68, gdp: 13900, hdi: 0.781, infl: 4.9, disp: 390, status: 'Protracted Insurgency', res: 66 },
  { id: 'HTI', name: 'Haiti', region: 'Latin America & Caribbean', flag: '🇭🇹', capital: 'Port-au-Prince', pop: 11.7, lat: 18.97, lng: -72.29, conflict: 88, gdp: 1650, hdi: 0.552, infl: 27.5, disp: 580, status: 'Active War', res: 18 },
  { id: 'VEN', name: 'Venezuela', region: 'Latin America & Caribbean', flag: '🇻🇪', capital: 'Caracas', pop: 28.8, lat: 6.42, lng: -66.59, conflict: 45, gdp: 3400, hdi: 0.699, infl: 190.0, disp: 7700, status: 'Protracted Insurgency', res: 35 },
  { id: 'GTM', name: 'Guatemala', region: 'Latin America & Caribbean', flag: '🇬🇹', capital: 'Guatemala City', pop: 18.1, lat: 15.78, lng: -90.23, conflict: 38, gdp: 5400, hdi: 0.635, infl: 4.2, disp: 240, status: 'Post-Conflict Recovery', res: 54 },
  { id: 'HND', name: 'Honduras', region: 'Latin America & Caribbean', flag: '🇭🇳', capital: 'Tegucigalpa', pop: 10.6, lat: 15.20, lng: -86.24, conflict: 42, gdp: 3200, hdi: 0.624, infl: 5.0, disp: 250, status: 'Protracted Insurgency', res: 50 },
  { id: 'SLV', name: 'El Salvador', region: 'Latin America & Caribbean', flag: '🇸🇻', capital: 'San Salvador', pop: 6.3, lat: 13.79, lng: -88.90, conflict: 18, gdp: 5300, hdi: 0.674, infl: 1.2, disp: 50, status: 'Post-Conflict Recovery', res: 62 },
  { id: 'NIC', name: 'Nicaragua', region: 'Latin America & Caribbean', flag: '🇳🇮', capital: 'Managua', pop: 7.0, lat: 12.87, lng: -85.21, conflict: 30, gdp: 2300, hdi: 0.669, infl: 6.1, disp: 200, status: 'Post-Conflict Recovery', res: 48 },
  { id: 'BRA', name: 'Brazil', region: 'Latin America & Caribbean', flag: '🇧🇷', capital: 'Brasilia', pop: 216.4, lat: -14.24, lng: -51.93, conflict: 32, gdp: 10300, hdi: 0.760, infl: 4.2, disp: 150, status: 'Stable / Benchmark', res: 76 },
  { id: 'ARG', name: 'Argentina', region: 'Latin America & Caribbean', flag: '🇦🇷', capital: 'Buenos Aires', pop: 46.7, lat: -38.42, lng: -63.62, conflict: 14, gdp: 13700, hdi: 0.849, infl: 210.0, disp: 0, status: 'Stable / Benchmark', res: 78 },
  { id: 'CHL', name: 'Chile', region: 'Latin America & Caribbean', flag: '🇨🇱', capital: 'Santiago', pop: 19.6, lat: -35.68, lng: -71.54, conflict: 12, gdp: 15800, hdi: 0.860, infl: 3.8, disp: 0, status: 'Stable / Benchmark', res: 84 },
  { id: 'PER', name: 'Peru', region: 'Latin America & Caribbean', flag: '🇵🇪', capital: 'Lima', pop: 34.4, lat: -9.19, lng: -75.02, conflict: 28, gdp: 7700, hdi: 0.762, infl: 2.5, disp: 60, status: 'Post-Conflict Recovery', res: 70 },
  { id: 'ECU', name: 'Ecuador', region: 'Latin America & Caribbean', flag: '🇪🇨', capital: 'Quito', pop: 18.2, lat: -1.83, lng: -78.18, conflict: 58, gdp: 6500, hdi: 0.765, infl: 2.1, disp: 180, status: 'Protracted Insurgency', res: 60 },
  { id: 'BOL', name: 'Bolivia', region: 'Latin America & Caribbean', flag: '🇧🇴', capital: 'Sucre', pop: 12.4, lat: -16.29, lng: -63.59, conflict: 25, gdp: 3700, hdi: 0.698, infl: 3.5, disp: 0, status: 'Stable / Benchmark', res: 58 },
  { id: 'PRY', name: 'Paraguay', region: 'Latin America & Caribbean', flag: '🇵🇾', capital: 'Asuncion', pop: 6.9, lat: -23.44, lng: -58.44, conflict: 16, gdp: 6200, hdi: 0.731, infl: 4.3, disp: 0, status: 'Stable / Benchmark', res: 66 },
  { id: 'URY', name: 'Uruguay', region: 'Latin America & Caribbean', flag: '🇺🇾', capital: 'Montevideo', pop: 3.4, lat: -32.52, lng: -55.77, conflict: 3, gdp: 21600, hdi: 0.830, infl: 4.8, disp: 0, status: 'Stable / Benchmark', res: 88 },
  { id: 'CRI', name: 'Costa Rica', region: 'Latin America & Caribbean', flag: '🇨🇷', capital: 'San Jose', pop: 5.2, lat: 9.75, lng: -83.75, conflict: 4, gdp: 13800, hdi: 0.806, infl: 0.8, disp: 0, status: 'Stable / Benchmark', res: 86 },
  { id: 'PAN', name: 'Panama', region: 'Latin America & Caribbean', flag: '🇵🇦', capital: 'Panama City', pop: 4.5, lat: 8.54, lng: -80.78, conflict: 10, gdp: 18700, hdi: 0.820, infl: 1.5, disp: 0, status: 'Stable / Benchmark', res: 82 },
  { id: 'DOM', name: 'Dominican Republic', region: 'Latin America & Caribbean', flag: '🇩🇴', capital: 'Santo Domingo', pop: 11.3, lat: 18.74, lng: -70.16, conflict: 12, gdp: 11200, hdi: 0.766, infl: 3.4, disp: 0, status: 'Stable / Benchmark', res: 75 },
  { id: 'CUB', name: 'Cuba', region: 'Latin America & Caribbean', flag: '🇨🇺', capital: 'Havana', pop: 11.2, lat: 21.52, lng: -77.78, conflict: 18, gdp: 9500, hdi: 0.764, infl: 31.0, disp: 0, status: 'Stable / Benchmark', res: 60 },
  { id: 'JAM', name: 'Jamaica', region: 'Latin America & Caribbean', flag: '🇯🇲', capital: 'Kingston', pop: 2.8, lat: 18.11, lng: -77.30, conflict: 30, gdp: 6800, hdi: 0.706, infl: 5.6, disp: 0, status: 'Stable / Benchmark', res: 72 },
  { id: 'TTO', name: 'Trinidad and Tobago', region: 'Latin America & Caribbean', flag: '🇹🇹', capital: 'Port of Spain', pop: 1.5, lat: 10.69, lng: -61.22, conflict: 28, gdp: 19800, hdi: 0.814, infl: 1.8, disp: 0, status: 'Stable / Benchmark', res: 78 },
  { id: 'GUY', name: 'Guyana', region: 'Latin America & Caribbean', flag: '🇬🇾', capital: 'Georgetown', pop: 0.8, lat: 4.86, lng: -58.93, conflict: 12, gdp: 20600, hdi: 0.716, infl: 2.0, disp: 0, status: 'Stable / Benchmark', res: 72 },
  { id: 'SUR', name: 'Suriname', region: 'Latin America & Caribbean', flag: '🇸🇷', capital: 'Paramaribo', pop: 0.6, lat: 3.92, lng: -56.03, conflict: 10, gdp: 5900, hdi: 0.690, infl: 35.0, disp: 0, status: 'Stable / Benchmark', res: 64 },

  // North America
  { id: 'USA', name: 'United States', region: 'North America & Europe', flag: '🇺🇸', capital: 'Washington, D.C.', pop: 335.8, lat: 37.09, lng: -95.71, conflict: 14, gdp: 76300, hdi: 0.927, infl: 2.9, disp: 0, status: 'Stable / Benchmark', res: 88 },
  { id: 'CAN', name: 'Canada', region: 'North America & Europe', flag: '🇨🇦', capital: 'Ottawa', pop: 40.5, lat: 56.13, lng: -106.35, conflict: 2, gdp: 53400, hdi: 0.935, infl: 2.6, disp: 0, status: 'Stable / Benchmark', res: 96 },

  // Oceania
  { id: 'AUS', name: 'Australia', region: 'South & Southeast Asia', flag: '🇦🇺', capital: 'Canberra', pop: 26.5, lat: -25.27, lng: 133.78, conflict: 2, gdp: 64500, hdi: 0.946, infl: 3.6, disp: 0, status: 'Stable / Benchmark', res: 96 },
  { id: 'NZL', name: 'New Zealand', region: 'South & Southeast Asia', flag: '🇳🇿', capital: 'Wellington', pop: 5.2, lat: -40.90, lng: 174.89, conflict: 2, gdp: 48500, hdi: 0.939, infl: 3.3, disp: 0, status: 'Stable / Benchmark', res: 97 },
  { id: 'PNG', name: 'Papua New Guinea', region: 'South & Southeast Asia', flag: '🇵🇬', capital: 'Port Moresby', pop: 10.3, lat: -6.31, lng: 143.96, conflict: 45, gdp: 3100, hdi: 0.568, infl: 5.0, disp: 80, status: 'Protracted Insurgency', res: 48 },
  { id: 'FJI', name: 'Fiji', region: 'South & Southeast Asia', flag: '🇫🇯', capital: 'Suva', pop: 0.9, lat: -17.71, lng: 178.07, conflict: 10, gdp: 5800, hdi: 0.729, infl: 4.8, disp: 0, status: 'Stable / Benchmark', res: 68 },
  { id: 'SLB', name: 'Solomon Islands', region: 'South & Southeast Asia', flag: '🇸🇧', capital: 'Honiara', pop: 0.7, lat: -9.65, lng: 160.16, conflict: 18, gdp: 2300, hdi: 0.562, infl: 3.8, disp: 0, status: 'Post-Conflict Recovery', res: 54 },
  { id: 'VUT', name: 'Vanuatu', region: 'South & Southeast Asia', flag: '🇻🇺', capital: 'Port Vila', pop: 0.3, lat: -15.38, lng: 166.96, conflict: 6, gdp: 3200, hdi: 0.614, infl: 2.8, disp: 0, status: 'Stable / Benchmark', res: 64 },
  { id: 'WSM', name: 'Samoa', region: 'South & Southeast Asia', flag: '🇼🇸', capital: 'Apia', pop: 0.2, lat: -13.76, lng: -172.10, conflict: 4, gdp: 4100, hdi: 0.707, infl: 3.0, disp: 0, status: 'Stable / Benchmark', res: 70 },
  { id: 'TON', name: 'Tonga', region: 'South & Southeast Asia', flag: '🇹🇴', capital: 'Nuku\'alofa', pop: 0.1, lat: -21.18, lng: -175.20, conflict: 4, gdp: 4600, hdi: 0.739, infl: 4.0, disp: 0, status: 'Stable / Benchmark', res: 68 },
  { id: 'MDV', name: 'Maldives', region: 'South & Southeast Asia', flag: '🇲🇻', capital: 'Male', pop: 0.5, lat: 3.20, lng: 73.22, conflict: 12, gdp: 12400, hdi: 0.762, infl: 2.1, disp: 0, status: 'Stable / Benchmark', res: 72 },
  { id: 'BTN', name: 'Bhutan', region: 'South & Southeast Asia', flag: '🇧🇹', capital: 'Thimphu', pop: 0.8, lat: 27.51, lng: 90.43, conflict: 4, gdp: 3700, hdi: 0.681, infl: 4.2, disp: 0, status: 'Stable / Benchmark', res: 82 },
  { id: 'BRN', name: 'Brunei', region: 'South & Southeast Asia', flag: '🇧🇳', capital: 'Bandar Seri Begawan', pop: 0.5, lat: 4.54, lng: 114.73, conflict: 2, gdp: 33400, hdi: 0.823, infl: 0.4, disp: 0, status: 'Stable / Benchmark', res: 84 },
  { id: 'CYP', name: 'Cyprus', region: 'North America & Europe', flag: '🇨🇾', capital: 'Nicosia', pop: 1.3, lat: 35.13, lng: 33.43, conflict: 22, gdp: 34100, hdi: 0.907, infl: 2.1, disp: 200, status: 'Post-Conflict Recovery', res: 86 },
  { id: 'MLT', name: 'Malta', region: 'North America & Europe', flag: '🇲🇹', capital: 'Valletta', pop: 0.5, lat: 35.94, lng: 14.38, conflict: 2, gdp: 35800, hdi: 0.915, infl: 2.4, disp: 0, status: 'Stable / Benchmark', res: 90 },
  { id: 'ISL', name: 'Iceland', region: 'North America & Europe', flag: '🇮🇸', capital: 'Reykjavik', pop: 0.4, lat: 64.96, lng: -19.02, conflict: 1, gdp: 74200, hdi: 0.959, infl: 5.8, disp: 0, status: 'Stable / Benchmark', res: 99 },
  { id: 'LUX', name: 'Luxembourg', region: 'North America & Europe', flag: '🇱🇺', capital: 'Luxembourg City', pop: 0.7, lat: 49.82, lng: 6.13, conflict: 1, gdp: 128700, hdi: 0.927, infl: 2.6, disp: 0, status: 'Stable / Benchmark', res: 97 },
  { id: 'EST', name: 'Estonia', region: 'Eastern Europe & Eurasia', flag: '🇪🇪', capital: 'Tallinn', pop: 1.4, lat: 58.60, lng: 25.01, conflict: 4, gdp: 29800, hdi: 0.899, infl: 3.4, disp: 0, status: 'Stable / Benchmark', res: 92 },
  { id: 'LVA', name: 'Latvia', region: 'Eastern Europe & Eurasia', flag: '🇱🇻', capital: 'Riga', pop: 1.9, lat: 56.88, lng: 24.60, conflict: 4, gdp: 21800, hdi: 0.879, infl: 2.2, disp: 0, status: 'Stable / Benchmark', res: 88 },
  { id: 'LTU', name: 'Lithuania', region: 'Eastern Europe & Eurasia', flag: '🇱🇹', capital: 'Vilnius', pop: 2.8, lat: 55.17, lng: 23.88, conflict: 4, gdp: 25700, hdi: 0.879, infl: 1.8, disp: 0, status: 'Stable / Benchmark', res: 90 },
  { id: 'SVK', name: 'Slovakia', region: 'Eastern Europe & Eurasia', flag: '🇸🇰', capital: 'Bratislava', pop: 5.4, lat: 48.67, lng: 19.70, conflict: 3, gdp: 23400, hdi: 0.855, infl: 2.8, disp: 0, status: 'Stable / Benchmark', res: 86 },
  { id: 'SVN', name: 'Slovenia', region: 'Eastern Europe & Eurasia', flag: '🇸🇮', capital: 'Ljubljana', pop: 2.1, lat: 46.15, lng: 14.99, conflict: 2, gdp: 32100, hdi: 0.926, infl: 2.5, disp: 0, status: 'Stable / Benchmark', res: 92 },
  { id: 'BGR', name: 'Bulgaria', region: 'Eastern Europe & Eurasia', flag: '🇧🇬', capital: 'Sofia', pop: 6.4, lat: 42.73, lng: 25.48, conflict: 5, gdp: 15800, hdi: 0.799, infl: 2.8, disp: 0, status: 'Stable / Benchmark', res: 76 },
  { id: 'MKD', name: 'North Macedonia', region: 'Eastern Europe & Eurasia', flag: '🇲🇰', capital: 'Skopje', pop: 1.8, lat: 41.61, lng: 21.75, conflict: 12, gdp: 7600, hdi: 0.774, infl: 3.5, disp: 0, status: 'Post-Conflict Recovery', res: 66 },
  { id: 'MNE', name: 'Montenegro', region: 'Eastern Europe & Eurasia', flag: '🇲🇪', capital: 'Podgorica', pop: 0.6, lat: 42.71, lng: 19.37, conflict: 10, gdp: 11400, hdi: 0.844, infl: 4.1, disp: 0, status: 'Post-Conflict Recovery', res: 72 },
  { id: 'SWZ', name: 'Eswatini', region: 'Sub-Saharan Africa', flag: '🇸🇿', capital: 'Mbabane', pop: 1.2, lat: -26.52, lng: 31.47, conflict: 24, gdp: 4100, hdi: 0.610, infl: 4.8, disp: 0, status: 'Protracted Insurgency', res: 50 },
  { id: 'LSO', name: 'Lesotho', region: 'Sub-Saharan Africa', flag: '🇱🇸', capital: 'Maseru', pop: 2.3, lat: -29.61, lng: 28.23, conflict: 20, gdp: 1100, hdi: 0.521, infl: 6.5, disp: 0, status: 'Stable / Benchmark', res: 52 },
  { id: 'DJI', name: 'Djibouti', region: 'Sub-Saharan Africa', flag: '🇩🇯', capital: 'Djibouti', pop: 1.1, lat: 11.83, lng: 42.59, conflict: 18, gdp: 3600, hdi: 0.515, infl: 1.8, disp: 35, status: 'Stable / Benchmark', res: 55 },
  { id: 'CPV', name: 'Cabo Verde', region: 'Sub-Saharan Africa', flag: '🇨🇻', capital: 'Praia', pop: 0.6, lat: 16.54, lng: -23.04, conflict: 4, gdp: 4300, hdi: 0.661, infl: 1.5, disp: 0, status: 'Stable / Benchmark', res: 78 },
  { id: 'GNQ', name: 'Equatorial Guinea', region: 'Sub-Saharan Africa', flag: '🇬🇶', capital: 'Malabo', pop: 1.7, lat: 1.65, lng: 10.27, conflict: 22, gdp: 7200, hdi: 0.605, infl: 2.4, disp: 0, status: 'Stable / Benchmark', res: 45 },
  { id: 'GNB', name: 'Guinea-Bissau', region: 'Sub-Saharan Africa', flag: '🇬🇼', capital: 'Bissau', pop: 2.1, lat: 11.80, lng: -15.18, conflict: 32, gdp: 910, hdi: 0.483, infl: 3.2, disp: 5, status: 'Protracted Insurgency', res: 40 },
  { id: 'BLZ', name: 'Belize', region: 'Latin America & Caribbean', flag: '🇧🇿', capital: 'Belmopan', pop: 0.4, lat: 17.19, lng: -88.50, conflict: 14, gdp: 6900, hdi: 0.700, infl: 4.1, disp: 0, status: 'Stable / Benchmark', res: 68 },
  { id: 'BHS', name: 'Bahamas', region: 'Latin America & Caribbean', flag: '🇧🇸', capital: 'Nassau', pop: 0.4, lat: 25.03, lng: -77.40, conflict: 12, gdp: 34200, hdi: 0.820, infl: 2.8, disp: 0, status: 'Stable / Benchmark', res: 80 },
  { id: 'BRB', name: 'Barbados', region: 'Latin America & Caribbean', flag: '🇧🇧', capital: 'Bridgetown', pop: 0.3, lat: 13.19, lng: -59.54, conflict: 8, gdp: 20100, hdi: 0.809, infl: 5.2, disp: 0, status: 'Stable / Benchmark', res: 84 },
];

console.log(`Processing ${rawCountries.length} countries...`);

// Helper to generate realistic historical time series
function generateHistory(c) {
  const years = [1995, 2000, 2005, 2010, 2015, 2018, 2020, 2022, 2024];
  const history = [];

  const currentConflict = c.conflict;
  const currentGdp = c.gdp;
  const currentHdi = c.hdi;
  const currentDisp = c.disp;

  years.forEach(year => {
    let yearConflict = currentConflict;
    let yearGdp = currentGdp;
    let yearHdi = currentHdi;
    let yearDisp = currentDisp;
    let note = undefined;

    // Time backwards progression
    const yearsAgo = 2024 - year;
    const progressFactor = (year - 1995) / (2024 - 1995);

    // Specific country milestones
    if (c.id === 'UKR') {
      if (year === 2024) { yearConflict = 92; yearGdp = 4530; yearHdi = 0.734; yearDisp = 9800; note = 'Protracted high-intensity warfare & resilience'; }
      else if (year === 2022) { yearConflict = 98; yearGdp = 3450; yearHdi = 0.725; yearDisp = 13500; note = 'Full-scale Russian invasion'; }
      else if (year === 2014) { yearConflict = 68; yearGdp = 3820; yearHdi = 0.747; yearDisp = 1400; note = 'Annexation of Crimea & Donbas conflict'; }
      else if (year <= 2005) { yearConflict = 3; yearGdp = 2800; yearHdi = 0.710; yearDisp = 20; }
    } else if (c.id === 'SYR') {
      if (year >= 2015) { yearConflict = 88; yearGdp = 1800; yearHdi = 0.560; yearDisp = 12000; note = 'Peak territorial warfare & refugee crisis'; }
      else if (year === 2011) { yearConflict = 65; yearGdp = 3400; yearHdi = 0.630; yearDisp = 2100; note = 'Civil war outbreak'; }
      else { yearConflict = 10; yearGdp = 4400; yearHdi = 0.660; yearDisp = 40; note = 'Pre-conflict economic peak'; }
    } else if (c.id === 'RWA') {
      if (year === 1995) { yearConflict = 80; yearGdp = 380; yearHdi = 0.330; yearDisp = 2500; note = 'Immediate aftermath of 1994 genocide'; }
      else if (year <= 2005) { yearConflict = 25; yearGdp = 600; yearHdi = 0.440; yearDisp = 300; note = 'Gacaca reconciliation and state reconstruction'; }
      else { yearConflict = 16; yearGdp = Math.round(1040 * progressFactor); yearHdi = Number((0.35 + 0.20 * progressFactor).toFixed(3)); yearDisp = 130; }
    } else if (c.id === 'BIH') {
      if (year === 1995) { yearConflict = 94; yearGdp = 1210; yearHdi = 0.612; yearDisp = 2200; note = 'Dayton Peace Agreement signed'; }
      else if (year === 2000) { yearConflict = 20; yearGdp = 2850; yearHdi = 0.678; yearDisp = 1100; note = 'Post-war reconstruction package'; }
      else { yearConflict = 12; yearGdp = Math.round(7850 * (0.4 + 0.6 * progressFactor)); yearHdi = Number((0.68 + 0.10 * progressFactor).toFixed(3)); yearDisp = 85; }
    } else if (c.id === 'COL') {
      if (year === 2016) { yearConflict = 35; yearGdp = 6400; yearHdi = 0.745; yearDisp = 6800; note = 'Historic Havana Peace Accord with FARC'; }
      else if (year <= 2002) { yearConflict = 85; yearGdp = 4200; yearHdi = 0.670; yearDisp = 3000; note = 'Peak paramilitary and guerrilla conflict'; }
      else { yearConflict = c.conflict; yearGdp = Math.round(c.gdp * (0.6 + 0.4 * progressFactor)); yearHdi = Number((c.hdi - 0.08 * (1 - progressFactor)).toFixed(3)); yearDisp = c.disp; }
    } else if (c.id === 'VNM') {
      if (year === 1995) { yearConflict = 10; yearGdp = 980; yearHdi = 0.550; yearDisp = 50; note = 'Normalization of US-Vietnam relations'; }
      else { yearConflict = 6; yearGdp = Math.round(4350 * (0.25 + 0.75 * progressFactor)); yearHdi = Number((0.55 + 0.176 * progressFactor).toFixed(3)); yearDisp = 0; }
    } else {
      // General realistic econometric trendline
      const growthFactor = Math.pow(1.025, -yearsAgo);
      yearGdp = Math.max(250, Math.round(currentGdp * growthFactor));
      yearHdi = Number(Math.max(0.28, Math.min(0.98, currentHdi - 0.003 * yearsAgo)).toFixed(3));
      
      if (c.status === 'Active War') {
        yearConflict = year >= 2020 ? currentConflict : Math.max(10, Math.round(currentConflict * 0.4));
        yearDisp = year >= 2020 ? currentDisp : Math.round(currentDisp * 0.3);
      } else if (c.status === 'Protracted Insurgency') {
        yearConflict = Math.max(15, Math.round(currentConflict * (0.8 + 0.2 * Math.sin(year))));
        yearDisp = Math.round(currentDisp * (0.7 + 0.3 * progressFactor));
      } else {
        yearConflict = Math.max(1, currentConflict);
        yearDisp = currentDisp;
      }
    }

    const gdpGrowth = year === 1995 ? 3.0 : Number(((Math.sin(year) * 2.5) + (yearConflict > 70 ? -8.0 : 3.8)).toFixed(1));
    const inflation = yearConflict > 70 ? Math.round(c.infl * 0.8) : Number((c.infl * (0.8 + 0.4 * Math.random())).toFixed(1));

    history.push({
      year,
      conflictIntensity: yearConflict,
      battleFatalities: yearConflict > 70 ? Math.round(yearConflict * 180) : Math.round(yearConflict * 15),
      gdpPerCapita: yearGdp,
      gdpGrowthRate: gdpGrowth,
      hdi: yearHdi,
      inflationRate: Math.max(0.5, inflation),
      displacedPersons: yearDisp,
      eventNote: note,
    });
  });

  return history;
}

// Transform raw countries into complete typescript structure
const countriesData = rawCountries.map(c => {
  // Compute SVG coordinates 0 - 1000 and 0 - 550 from lat and lng
  const x = Math.round(((c.lng + 180) * (1000 / 360)));
  const y = Math.round(((90 - c.lat) * (550 / 180)));

  const correlation = c.conflict > 60 ? -0.85 : c.conflict > 30 ? -0.65 : -0.28;
  const costPct = Number(((c.conflict / 100) * 4.8 + 0.5).toFixed(1));
  const dividend = Number((costPct * 1.35).toFixed(1));

  return {
    id: c.id,
    name: c.name,
    region: c.region,
    flag: c.flag,
    capital: c.capital,
    population: c.pop,
    currentConflictIntensity: c.conflict,
    currentGdpPerCapita: c.gdp,
    currentHdi: c.hdi,
    currentInflation: c.infl,
    currentDisplaced: c.disp,
    conflictStatus: c.status,
    mapCoords: { x, y },
    lat: c.lat,
    lng: c.lng,
    econometrics: {
      conflictGdpCorrelation: correlation,
      conflictHdiCorrelation: Number((correlation + 0.04).toFixed(2)),
      lagImpactYears: Number((1.0 + (c.conflict / 100) * 1.5).toFixed(1)),
      estimatedAnnualCostPct: costPct,
      peaceDividendPotential: dividend,
      institutionalResilience: c.res,
    },
    history: generateHistory(c),
  };
});

const fileContent = `import { CountryData } from '../types';

export const COUNTRIES_DATA: CountryData[] = ${JSON.stringify(countriesData, null, 2)};

export const REGIONS: readonly string[] = [
  'All',
  'Middle East & North Africa',
  'Sub-Saharan Africa',
  'Eastern Europe & Eurasia',
  'South & Southeast Asia',
  'Latin America & Caribbean',
  'North America & Europe',
];
`;

fs.writeFileSync('src/data/countriesData.ts', fileContent, 'utf8');
console.log(`Generated src/data/countriesData.ts successfully with ${countriesData.length} countries worldwide.`);
