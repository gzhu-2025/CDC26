// Engine API client for the map (see contracts/api/openapi.json).
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request(path) {
  const res = await fetch(`${API}${path}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.detail ?? `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return body
}

export const getMapMetrics = () => request('/map/metrics')
export const getMapLayer = (metric) => request(`/map?metric=${encodeURIComponent(metric)}`)
export const getCountrySummary = (iso3) => request(`/country/${iso3}/summary`)
export const getFindings = () => request('/findings')
export const getCountries = () => request('/countries')
