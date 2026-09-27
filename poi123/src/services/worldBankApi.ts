import { WORLD_BANK_SOURCES, WorldBankSource } from '../data/worldBankSources';
import { WORLD_BANK_INDICATORS } from '../types';

export interface WorldBankApiResponse<T> {
  page: number;
  pages: number;
  per_page: number;
  total: number;
  data: T[];
}

export interface WorldBankIndicatorRecord {
  indicator: {
    id: string;
    value: string;
  };
  country: {
    id: string;
    value: string;
  };
  countryiso3code: string;
  date: string;
  value: number | null;
  unit: string;
  obs_status: string;
  decimal: number;
}

const BASE_URL = 'https://api.worldbank.org/v2';

/**
 * Fetch all data sources directly from World Bank API: https://api.worldbank.org/v2/sources
 */
export async function fetchWorldBankSources(): Promise<WorldBankSource[]> {
  try {
    const res = await fetch(`${BASE_URL}/sources?format=json&per_page=100`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (Array.isArray(json) && json.length > 1 && Array.isArray(json[1])) {
      return json[1] as WorldBankSource[];
    }
    return WORLD_BANK_SOURCES;
  } catch (err) {
    console.warn('World Bank API sources fetch failed, using cached sources catalog:', err);
    return WORLD_BANK_SOURCES;
  }
}

/**
 * Fetch country metadata from World Bank API: https://api.worldbank.org/v2/country/{countryCode}
 */
export async function fetchWorldBankCountry(countryCode: string) {
  try {
    const res = await fetch(`${BASE_URL}/country/${countryCode}?format=json`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return json[1]?.[0] || null;
  } catch (err) {
    console.warn(`Failed to fetch country ${countryCode} from World Bank API:`, err);
    return null;
  }
}

/**
 * Fetch indicator time series from World Bank API:
 * https://api.worldbank.org/v2/country/{country}/indicator/{indicator}
 */
export async function fetchWorldBankIndicator(
  countryCode: string,
  indicatorCode: string,
  dateRange: string = '1995:2024'
): Promise<WorldBankIndicatorRecord[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/country/${countryCode}/indicator/${indicatorCode}?format=json&date=${dateRange}&per_page=50`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (Array.isArray(json) && json.length > 1 && Array.isArray(json[1])) {
      return json[1] as WorldBankIndicatorRecord[];
    }
    return [];
  } catch (err) {
    console.warn(`Failed to fetch indicator ${indicatorCode} for ${countryCode}:`, err);
    return [];
  }
}

/**
 * Fetch indicator metadata from World Bank API:
 * https://api.worldbank.org/v2/indicator/{indicator}
 */
export async function fetchWorldBankIndicatorInfo(indicatorCode: string) {
  try {
    const res = await fetch(`${BASE_URL}/indicator/${indicatorCode}?format=json`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return json[1]?.[0] || null;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch Data360 dataset metadata and indicators for Human Capital Index Plus (WB_HCIP)
 * Reference: https://data360.worldbank.org/en/dataset/WB_HCIP
 */
export async function fetchWorldBankData360HciPlus(countryCode?: string) {
  try {
    const endpoint = countryCode 
      ? `https://api.worldbank.org/v2/country/${countryCode}/indicator/HD.HCI.OVRL?format=json&date=1995:2024&per_page=50`
      : `https://api.worldbank.org/v2/sources/63?format=json`;
    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn(`Data360 WB_HCIP fetch fallback:`, err);
    return null;
  }
}

export { WORLD_BANK_SOURCES, WORLD_BANK_INDICATORS };
