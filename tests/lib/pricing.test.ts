import { describe, expect, it } from "vitest"

import { formatRwf } from "@/lib/order/money"
import { computeLine, computeOrderTotals } from "@/lib/order/pricing"

describe("computeLine", () => {
  it("multiplies (unit + modifiers) by quantity", () => {
    expect(computeLine({ unitPrice: 5500, quantity: 2, modifierPrices: [500, 500] })).toEqual({
      modifiersTotal: 1000,
      lineTotal: 13000,
    })
  })

  it("handles a line with no modifiers", () => {
    expect(computeLine({ unitPrice: 1200, quantity: 3, modifierPrices: [] })).toEqual({ modifiersTotal: 0, lineTotal: 3600 })
  })

  it.each([0, -1, 21, 1.5, Number.NaN])("rejects invalid quantity %s", (quantity) => {
    expect(() => computeLine({ unitPrice: 1000, quantity, modifierPrices: [] })).toThrow(RangeError)
  })

  it("rejects fractional or negative francs (integers only)", () => {
    expect(() => computeLine({ unitPrice: 1000.5, quantity: 1, modifierPrices: [] })).toThrow(RangeError)
    expect(() => computeLine({ unitPrice: 1000, quantity: 1, modifierPrices: [-500] })).toThrow(RangeError)
  })
})

describe("computeOrderTotals", () => {
  const lines = [
    { unitPrice: 3000, quantity: 1, modifierPrices: [500] }, // Classic Beef + cheese
    { unitPrice: 1200, quantity: 2, modifierPrices: [0] }, // 2 drinks
  ]

  it("sums lines into subtotal and total for pickup", () => {
    expect(computeOrderTotals(lines, 0)).toEqual({
      lines: [
        { modifiersTotal: 500, lineTotal: 3500 },
        { modifiersTotal: 0, lineTotal: 2400 },
      ],
      subtotal: 5900,
      deliveryFee: 0,
      total: 5900,
    })
  })

  it("adds the delivery fee to the total, not the subtotal", () => {
    const t = computeOrderTotals(lines, 1000)
    expect(t.subtotal).toBe(5900)
    expect(t.deliveryFee).toBe(1000)
    expect(t.total).toBe(6900)
  })

  it("produces only safe integers", () => {
    const t = computeOrderTotals(lines, 700)
    for (const v of [t.subtotal, t.deliveryFee, t.total, ...t.lines.map((l) => l.lineTotal)]) {
      expect(Number.isSafeInteger(v)).toBe(true)
    }
  })
})

describe("formatRwf", () => {
  it("matches the printed menu format", () => {
    expect(formatRwf(4000)).toBe("4,000 RWF")
    expect(formatRwf(500)).toBe("500 RWF")
    expect(formatRwf(0)).toBe("0 RWF")
  })
})
