'use client'

import { useEffect } from 'react'

/** Registers `public/sw.js` in production builds (offline fallback only; see that file). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Installability and offline fallback are progressive enhancements; ignore failures.
    })
  }, [])

  return null
}
