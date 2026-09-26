"use client"

import { useEffect } from "react"

/**
 * Registers public/service-worker.js (hogwarts pattern). Production only, with
 * an escape hatch so `next build && next start` can verify the worker locally
 * (NEXT_PUBLIC_SW_DEV=1). `next dev` never registers it: HMR chunks would
 * poison the static cache.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !(process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "1")
    ) {
      return
    }

    let interval: number | undefined
    const register = () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          // Some automated browsers resolve with undefined instead of rejecting.
          if (!registration) return
          interval = window.setInterval(() => registration.update(), 60 * 60 * 1000)
        })
        .catch((error) => console.error("Service worker registration failed", error))
    }

    // Wait for `load` so registration never competes with the first paint —
    // but a page restored from cache can be loaded before this effect runs,
    // and a `load` listener added then never fires.
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })

    return () => {
      window.removeEventListener("load", register)
      if (interval !== undefined) window.clearInterval(interval)
    }
  }, [])

  return null
}
