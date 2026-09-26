"use client"

import { useEffect, useRef, useState } from "react"

import type { ActionResponse } from "@/lib/action-response"
import { useVisiblePoll } from "@/hooks/use-visible-poll"

import { playChime } from "./sound"

export const STAFF_POLL_MS = 5_000
/** How often the chime repeats while orders still wait for a person. */
export const REMIND_MS = 30_000

type Options<T> = {
  /** Orders waiting for this screen — shown as "(n)" in the tab title. */
  waiting?: (orders: T[]) => number
  /** Keep chiming every REMIND_MS while anything is waiting. */
  remind?: boolean
}

/**
 * Keeps a staff queue fresh without manual refresh: a 5 s poll of a server
 * action (no realtime platform needed for one restaurant) that keeps going
 * behind other tabs. Orders that arrive while the screen is open are
 * highlighted, chime and vibrate; connection trouble is reported.
 */
export function useLiveQueue<T extends { id: string }>(
  initial: T[],
  fetcher: () => Promise<ActionResponse<T[]>>,
  { waiting, remind = false }: Options<T> = {}
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
        playChime()
        if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200])
      }
      setOrders(res.data)
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }

  useVisiblePoll(refresh, STAFF_POLL_MS, true, true)

  const waitingCount = waiting ? waiting(orders) : 0

  // "(2) Orders" in the tab title, so a waiting order shows from another tab.
  const baseTitle = useRef<string | null>(null)
  useEffect(() => {
    baseTitle.current ??= document.title.replace(/^\(\d+\)\s*/, "")
    document.title = waitingCount > 0 ? `(${waitingCount}) ${baseTitle.current}` : baseTitle.current
  }, [waitingCount])
  useEffect(
    () => () => {
      if (baseTitle.current) document.title = baseTitle.current
    },
    []
  )

  // A waiting order keeps ringing until someone takes it.
  useEffect(() => {
    if (!remind || waitingCount === 0) return
    const id = window.setInterval(playChime, REMIND_MS)
    return () => window.clearInterval(id)
  }, [remind, waitingCount])

  const acknowledge = (id: string) =>
    setFresh((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  return { orders, setOrders, offline, fresh, acknowledge, refresh }
}
