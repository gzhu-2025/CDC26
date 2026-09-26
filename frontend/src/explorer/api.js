// Client for the modeling-engine API (see contracts/api/openapi.json).
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request(path, options) {
  const res = await fetch(`${API}${path}`, options)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail ?? `HTTP ${res.status}`)
  return body
}

export const getCountries = () => request('/countries')
export const getHistory = (iso3) => request(`/history/${iso3}`)
export const getPresets = () => request('/presets')
export const simulate = (params) =>
  request('/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
