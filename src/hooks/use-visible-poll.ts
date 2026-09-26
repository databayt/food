"use client"

import { useEffect, useRef } from "react"

/**
 * Visibility-aware polling (mkan travel/trips seat poll): runs `tick` every
 * `intervalMs` while the tab is visible, and immediately when it becomes
 * visible again or the network comes back. Hidden tabs cost nothing — unless
 * `background` is set: staff queues keep polling behind another tab so a new
 * order can still chime (browsers throttle hidden timers to about once a
 * minute; an installed app in the foreground polls at full speed).
 */
export function useVisiblePoll(tick: () => void | Promise<void>, intervalMs: number, enabled = true, background = false) {
  const tickRef = useRef(tick)
  useEffect(() => {
    tickRef.current = tick
  })

  useEffect(() => {
    if (!enabled) return
    let running = false
    const run = async () => {
      if (running || (!background && document.visibilityState !== "visible")) return
      running = true
      try {
        await tickRef.current()
      } finally {
        running = false
      }
    }
    const id = window.setInterval(run, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === "visible") void run()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onVisible)
    }
  }, [intervalMs, enabled, background])
}
