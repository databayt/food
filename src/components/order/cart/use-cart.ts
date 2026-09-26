"use client"

import { useSyncExternalStore } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { STORAGE_KEYS } from "@/lib/order/storage"
import { MAX_LINES, MAX_QUANTITY } from "@/lib/order/pricing"

import type { CartLine } from "./types"
import { lineSignature } from "./util"

type CartState = {
  lines: CartLine[]
  add: (line: Omit<CartLine, "key">) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
}

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const clampQty = (q: number) => Math.min(Math.max(Math.round(q), 1), MAX_QUANTITY)

/** The cart (zustand + localStorage, mkan's state library). Ids only. */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (incoming) =>
        set((state) => {
          const sig = lineSignature(incoming)
          const existing = state.lines.find((l) => lineSignature(l) === sig)
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.key === existing.key ? { ...l, quantity: clampQty(l.quantity + incoming.quantity) } : l
              ),
            }
          }
          if (state.lines.length >= MAX_LINES) return state
          return { lines: [...state.lines, { ...incoming, quantity: clampQty(incoming.quantity), key: newKey() }] }
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({ lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: clampQty(quantity) } : l)) })),
      remove: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: STORAGE_KEYS.cart,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
    }
  )
)

const subscribeHydration = (cb: () => void) => useCart.persist.onFinishHydration(cb)

/** True once the persisted cart has loaded — render cart UI only after this. */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    () => useCart.persist.hasHydrated(),
    () => false
  )
}
