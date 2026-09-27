import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/** Sticky "Back to map" button, shown once the hero map is out of view. */
export default function BackToMap({ heroRef }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [heroRef])
  return (
    <button
      type="button"
      className={`back-to-map ${show ? 'show' : ''}`}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      onClick={() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
    >
      <ArrowUp size={16} aria-hidden="true" /> Back to map
    </button>
  )
}
