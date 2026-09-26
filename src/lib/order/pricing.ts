import { assertFrancs } from "./money"

/**
 * Server-authoritative order pricing. Pure, integer-only — every input price
 * comes from the database, never from the client.
 */
export type PricedLine = {
  unitPrice: number
  quantity: number
  modifierPrices: number[]
}

export type LineTotals = { modifiersTotal: number; lineTotal: number }

export type OrderTotals = {
  lines: LineTotals[]
  subtotal: number
  deliveryFee: number
  total: number
}

export const MAX_QUANTITY = 20
export const MAX_LINES = 30

export function computeLine(line: PricedLine): LineTotals {
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
    throw new RangeError(`Invalid quantity: ${line.quantity}`)
  }
  const modifiersTotal = line.modifierPrices.reduce((sum, p) => sum + assertFrancs(p), 0)
  const lineTotal = (assertFrancs(line.unitPrice) + modifiersTotal) * line.quantity
  return { modifiersTotal, lineTotal: assertFrancs(lineTotal) }
}

export function computeOrderTotals(lines: PricedLine[], deliveryFee: number): OrderTotals {
  const computed = lines.map(computeLine)
  const subtotal = computed.reduce((sum, l) => sum + l.lineTotal, 0)
  const fee = assertFrancs(deliveryFee)
  return { lines: computed, subtotal, deliveryFee: fee, total: assertFrancs(subtotal + fee) }
}
