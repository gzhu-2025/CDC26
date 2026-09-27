import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { getFindings, getMapLayer, getMapMetrics } from '../map-layers/engineApi.js'
import CountryPanel from '../country-panel/CountryPanel.jsx'
import { useCountryRoute } from '../country-panel/useCountryRoute.js'
import Header from './Header.jsx'
import Hero from './Hero.jsx'
import BackToMap from './BackToMap.jsx'
import '../theme/tokens.css'
import './site.css'

// Below-the-fold sections load after the map is interactive.
const Findings = lazy(() => import('../findings/Findings.jsx'))

const scrollToId = (id) =>
  document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })

export default function SitePage() {
  const [catalog, setCatalog] = useState([])
  const [metric, setMetric] = useState('intensity_12m')
  const [layer, setLayer] = useState({ metric: null, values: null })
  const [findings, setFindings] = useState(null)
  const [error, setError] = useState(null)
  const country = useCountryRoute()
  const heroRef = useRef(null)

  useEffect(() => {
    getMapMetrics().then((r) => setCatalog(r.data)).catch((e) => setError(e.message))
    getFindings().then((r) => setFindings(r.data)).catch(() => setFindings(false))
  }, [])

  useEffect(() => {
    getMapLayer(metric)
      .then((r) => setLayer({ metric, values: r.data }))
      .catch((e) => setError(e.message))
  }, [metric])

  // "see them on the map" / ranked-list clicks from the findings below
  const showOnMap = useCallback((nextMetric, iso3) => {
    if (nextMetric) setMetric(nextMetric)
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    if (iso3) country.open(iso3)
  }, [country])

  const info = catalog.find((m) => m.name === metric)
  const asOf = findings?.acled_as_of ?? (layer.values ? Object.values(layer.values)[0]?.as_of : null)

  return (
    <div className="site">
      <a className="skip-link" href="#findings" onClick={(e) => { e.preventDefault(); scrollToId('findings') }}>
        Skip to findings
      </a>
      <Header
        catalog={catalog}
        metric={metric}
        onMetric={setMetric}
        onCountry={(iso3) => showOnMap(null, iso3)}
        onAbout={() => scrollToId('about')}
        onMethods={() => scrollToId('limits')}
      />
      <main>
        <Hero
          ref={heroRef}
          metric={metric}
          info={info}
          layer={layer}
          asOf={asOf}
          hero={findings ? findings.hero : null}
          error={error}
          selected={country.iso3}
          onSelect={country.open}
          onBackgroundClick={country.close}
          onScrollCue={() => scrollToId('findings')}
        />
        <div id="findings">
          <Suspense fallback={<div className="findings-loading">Loading findings…</div>}>
            {findings === false ? (
              <p className="findings-loading">Findings are not available yet (run the findings batch).</p>
            ) : findings ? (
              <Findings findings={findings} onShowOnMap={showOnMap} />
            ) : (
              <div className="findings-loading">Loading findings…</div>
            )}
          </Suspense>
        </div>
      </main>
      <BackToMap heroRef={heroRef} />
      <CountryPanel
        iso3={country.iso3}
        onClose={country.close}
        returnFocusTo={() => document.querySelector('.leaflet-container')}
      />
    </div>
  )
}
