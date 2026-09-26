"use client"

import { useRef, useState } from "react"

import type { ActionResponse } from "@/lib/action-response"
import { useVisiblePoll } from "@/hooks/use-visible-poll"

export const STAFF_POLL_MS = 5_000

/**
 * Keeps a staff queue fresh without manual refresh: a visibility-aware 5 s
 * poll of a server action (no realtime platform needed for one restaurant).
 * Tracks ids that arrived since the screen opened so new orders can be
 * highlighted, and reports connection trouble.
 */
export function useLiveQueue<T extends { id: string }>(
  initial: T[],
  fetcher: () => Promise<ActionResponse<T[]>>
) {
  const [orders, setOrders] = useState(initial)
  const [offline, setOffline] = useState(false)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const known = useRef(new Set(initial.map((o) => o.id)))

  const refresh = async () => {
    try {
      const res = await fetcher()
      if (!res.success) {
        setOffline(true)
        return
      }
      const arrived = res.data.filter((o) => !known.current.has(o.id)).map((o) => o.id)
      res.data.forEach((o) => known.current.add(o.id))
      if (arrived.length > 0) {
        setFresh((prev) => new Set([...prev, ...arrived]))
        if ("vibrate" in navigator) navigator.vibrate?.(200)
      }
      setOrders(res.data)
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }

  useVisiblePoll(refresh, STAFF_POLL_MS)

  const acknowledge = (id: string) =>
    setFresh((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  return { orders, setOrders, offline, fresh, acknowledge, refresh }
}
