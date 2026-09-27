import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'

const coarse = () => window.matchMedia('(pointer: coarse)').matches

/**
 * Keeps the full-screen map from trapping page scroll.
 * - Mouse wheel scrolls the page; Ctrl/Cmd + wheel zooms the map (a hint shows otherwise).
 * - Touch: one finger scrolls the page (touch-action: pan-y); two fingers pan and zoom
 *   (Leaflet's pinch handler moves the map with the pinch center).
 * Returns the hint text to show, or null.
 */
export function useScrollSafeMap() {
  const map = useMap()
  const [hint, setHint] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    const el = map.getContainer()
    const flash = (text) => {
      setHint(text)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setHint(null), 1400)
    }

    map.scrollWheelZoom.disable()
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault() // also stops the browser's own page zoom
        const delta = e.deltaY < 0 ? 1 : -1
        map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() + delta * 0.5)
      } else {
        flash(navigator.platform.toLowerCase().includes('mac') ? 'Use ⌘ + scroll to zoom the map' : 'Use Ctrl + scroll to zoom the map')
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    let onTouchMove = null
    if (coarse()) {
      map.dragging.disable() // one finger belongs to the page
      map.touchZoom.enable() // two fingers: pinch zoom + pan
      el.style.touchAction = 'pan-y'
      onTouchMove = (e) => { if (e.touches.length === 1) flash('Use two fingers to move the map') }
      el.addEventListener('touchmove', onTouchMove, { passive: true })
    }
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (onTouchMove) el.removeEventListener('touchmove', onTouchMove)
      clearTimeout(timer.current)
    }
  }, [map])

  return hint
}

/** Renders the hint inside the map container. */
export function ScrollSafe({ onHint }) {
  const hint = useScrollSafeMap()
  useEffect(() => onHint(hint), [hint, onHint])
  return null
}
