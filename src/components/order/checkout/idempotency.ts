"use client"

/**
 * One idempotency key per checkout attempt, scoped to the cart contents.
 * A retry of the same cart (double tap, flaky network, reload) reuses the key,
 * so the server returns the same order instead of creating a second one.
 * Changing the cart mints a new key.
 */
const KEY = "cb:checkout-key"

function uuid(): string {
  return crypto.randomUUID()
}

export function getCheckoutKey(signature: string): string {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { sig: string; key: string } | null
    if (stored && stored.sig === signature) return stored.key
    const key = uuid()
    sessionStorage.setItem(KEY, JSON.stringify({ sig: signature, key }))
    return key
  } catch {
    return uuid()
  }
}

export function clearCheckoutKey(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
