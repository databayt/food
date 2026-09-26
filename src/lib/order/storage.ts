/**
 * Privacy-conscious, device-only memory (no accounts). Every access is
 * wrapped: private mode, blocked storage or quota errors must never break
 * ordering.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable — ignore
  }
}

export const STORAGE_KEYS = {
  cart: "cb:cart",
  customer: "cb:customer",
  orders: "cb:orders",
  checkoutKey: "cb:checkout-key",
} as const
