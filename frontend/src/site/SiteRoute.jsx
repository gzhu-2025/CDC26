import { lazy, Suspense } from 'react'

// Map + findings page, loaded (with its theme) only when /site is visited.
const SitePage = lazy(() => import('./SitePage.jsx'))

export default function SiteRoute() {
  return (
    <Suspense fallback={null}>
      <SitePage />
    </Suspense>
  )
}
