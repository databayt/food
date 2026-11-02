"use client"

import { useSyncExternalStore } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { CartLine } from "@/components/order/cart/types"
import { lineSignature } from "@/components/order/cart/util"
import { MAX_LINES, MAX_QUANTITY } from "@/lib/order/pricing"

export type TicketFields = { name: string; phone: string; address: string; note: string }

type TicketState = TicketFields & {
  lines: CartLine[]
  fulfillment: "PICKUP" | "DELIVERY"
  /** Idempotency key of the ticket being charged — a retry can't ring it up twice. */
  chargeKey: string | null
  add: (line: Omit<CartLine, "key">) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  setField: (field: keyof TicketFields, value: string) => void
  setFulfillment: (fulfillment: "PICKUP" | "DELIVERY") => void
  /** The key for this charge attempt (minted once, reused on retries). */
  takeChargeKey: () => string
  /** Charging failed for good (cancelled prompt): the next try is a new order. */
  dropChargeKey: () => void
  clear: () => void
}

const EMPTY: TicketFields & Pick<TicketState, "lines" | "fulfillment" | "chargeKey"> = {
  lines: [],
  fulfillment: "PICKUP",
  chargeKey: null,
  name: "",
  phone: "",
  address: "",
  note: "",
}

const clampQty = (q: number) => Math.min(Math.max(Math.round(q), 1), MAX_QUANTITY)

/**
 * The counter ticket — the guest cart's shape (ids only; names and prices
 * come from the live menu), kept per browser tab so a reload doesn't lose a
 * half-rung order. Any edit after a charge attempt mints a new key.
 */
export const useTicket = create<TicketState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      add: (incoming) =>
        set((state) => {
          const sig = lineSignature(incoming)
          const existing = state.lines.find((l) => lineSignature(l) === sig)
          if (existing) {
            return {
              chargeKey: null,
              lines: state.lines.map((l) => (l.key === existing.key ? { ...l, quantity: clampQty(l.quantity + incoming.quantity) } : l)),
            }
          }
          if (state.lines.length >= MAX_LINES) return state
          return { chargeKey: null, lines: [...state.lines, { ...incoming, quantity: clampQty(incoming.quantity), key: crypto.randomUUID() }] }
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({ chargeKey: null, lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: clampQty(quantity) } : l)) })),
      remove: (key) => set((state) => ({ chargeKey: null, lines: state.lines.filter((l) => l.key !== key) })),
      setField: (field, value) => set({ [field]: value, chargeKey: null }),
      setFulfillment: (fulfillment) => set({ fulfillment, chargeKey: null }),
      takeChargeKey: () => {
        const current = get().chargeKey
        if (current) return current
        const key = crypto.randomUUID()
        set({ chargeKey: key })
        return key
      },
      dropChargeKey: () => set({ chargeKey: null }),
      clear: () => set({ ...EMPTY }),
    }),
    {
      name: "cb:pos-ticket",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ lines, fulfillment, chargeKey, name, phone, address, note }) => ({ lines, fulfillment, chargeKey, name, phone, address, note }),
    }
  )
)

const subscribeHydration = (cb: () => void) => useTicket.persist.onFinishHydration(cb)

export function useTicketHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, () => useTicket.persist.hasHydrated(), () => false)
}
