import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { getCountries, getMapLayer } from '../map-layers/engineApi.js'

/** Type-ahead over countries that have data; Enter/click opens the country panel. */
function CountrySearch({ onSelect }) {
  const [all, setAll] = useState([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const inputRef = useRef(null)

  useEffect(() => {
    Promise.all([getCountries(), getMapLayer('intensity_12m')])
      .then(([c, layer]) => {
        const withData = new Set(Object.entries(layer.data).filter(([, r]) => r.value != null).map(([i]) => i))
        setAll(c.data.filter((x) => withData.has(x.iso3)).map((x) => ({ iso3: x.iso3, name: x.name }))
          .sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => setAll([]))
  }, [])

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const starts = all.filter((c) => c.name.toLowerCase().startsWith(s) || c.iso3.toLowerCase() === s)
    const contains = all.filter((c) => !starts.includes(c) && c.name.toLowerCase().includes(s))
    return [...starts, ...contains].slice(0, 8)
  }, [q, all])

  const choose = (c) => {
    onSelect(c.iso3)
    setQ('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="search" role="search">
      <Search size={16} aria-hidden="true" className="search-icon" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Country…"
        aria-label="Find a country"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].iso3}` : undefined}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && matches[active]) { e.preventDefault(); choose(matches[active]) }
          if (e.key === 'Escape') { setQ(''); setOpen(false) }
        }}
      />
      {open && matches.length > 0 && (
        <ul className="search-list" id={listId} role="listbox">
          {matches.map((c, i) => (
            <li
              key={c.iso3}
              id={`${listId}-${c.iso3}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); choose(c) }}
              onMouseEnter={() => setActive(i)}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Header({ catalog, metric, onMetric, onCountry, onAbout, onMethods }) {
  return (
    <header className="site-header">
      <a className="brand" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0 }) }}>War Watch</a>
      <label className="layer-switch">
        <span className="visually-hidden">Map layer</span>
        <select value={metric} onChange={(e) => onMetric(e.target.value)} aria-label="Map layer">
          {catalog.map((m) => <option key={m.name} value={m.name}>{m.label}</option>)}
        </select>
      </label>
      <CountrySearch onSelect={onCountry} />
      <nav className="header-links" aria-label="Page sections">
        <button type="button" onClick={onAbout}>About</button>
        <button type="button" onClick={onMethods}>Methods &amp; limits</button>
      </nav>
    </header>
  )
}
