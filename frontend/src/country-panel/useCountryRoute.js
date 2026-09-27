import { useCallback, useEffect, useState } from 'react'

const RE = /^#\/country\/([A-Za-z0-9]{3})$/
const parse = () => {
  const m = RE.exec(window.location.hash)
  return m ? m[1].toUpperCase() : null
}

// True when the open panel's history entry was pushed by this page, so closing can simply
// go back (and the browser back button closes it too).
let pushedHere = false

/** Shareable #/country/{ISO3} route for the country panel. */
export function useCountryRoute() {
  const [iso3, setIso3] = useState(parse)

  useEffect(() => {
    const onChange = () => {
      const next = parse()
      if (!next) pushedHere = false
      setIso3(next)
    }
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])

  const open = useCallback((code) => {
    const target = `#/country/${code}`
    if (window.location.hash === target) return
    if (parse()) {
      // switching countries: replace, so one Back still closes the panel
      window.history.replaceState(null, '', target)
      setIso3(code)
    } else {
      pushedHere = true
      window.location.hash = target
    }
  }, [])

  const close = useCallback(() => {
    if (!parse()) return
    if (pushedHere) {
      window.history.back()
    } else {
      // opened from a shared link: don't navigate away from the site
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setIso3(null)
    }
  }, [])

  return { iso3, open, close }
}
