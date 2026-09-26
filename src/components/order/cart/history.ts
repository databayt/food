"use client"

import { readJson, STORAGE_KEYS, writeJson } from "@/lib/order/storage"

import type { RememberedOrder } from "./types"

const MAX_REMEMBERED = 5

const EMPTY: RememberedOrder[] = []
let cachedRaw: string | null | undefined
let cachedList: RememberedOrder[] = EMPTY

/** Stable snapshot for useSyncExternalStore — re-parses only when storage changed. */
export function rememberedOrdersSnapshot(): RememberedOrder[] {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEYS.orders)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedList = raw ? getRememberedOrders() : EMPTY
  }
  return cachedList
}

export const rememberedOrdersServerSnapshot = (): RememberedOrder[] => EMPTY

export function subscribeRememberedOrders(onChange: () => void): () => void {
  window.addEventListener("storage", onChange)
  return () => window.removeEventListener("storage", onChange)
}

export function getRememberedOrders(): RememberedOrder[] {
  const list = readJson<RememberedOrder[]>(STORAGE_KEYS.orders, [])
  return Array.isArray(list) ? list.filter((o) => o && typeof o.token === "string") : []
}

export function rememberOrder(order: RememberedOrder): void {
  const rest = getRememberedOrders().filter((o) => o.token !== order.token)
  writeJson(STORAGE_KEYS.orders, [order, ...rest].slice(0, MAX_REMEMBERED))
}

export type RememberedCustomer = {
  name: string
  phone: string
  fulfillment?: "PICKUP" | "DELIVERY"
  paymentMethod?: "CASH" | "MOMO"
  address?: string
}

export function getRememberedCustomer(): RememberedCustomer | null {
  const c = readJson<RememberedCustomer | null>(STORAGE_KEYS.customer, null)
  return c && typeof c.name === "string" && typeof c.phone === "string" ? c : null
}

export function rememberCustomer(customer: RememberedCustomer): void {
  writeJson(STORAGE_KEYS.customer, customer)
}
