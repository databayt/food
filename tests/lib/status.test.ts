import type { OrderStatus, UserRole } from "@prisma/client"
import { describe, expect, it } from "vitest"

import { canTransition, isTerminal, isValidTransition, nextStatus } from "@/lib/order/status"

const ALL: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]

describe("order state machine", () => {
  it("has exactly one forward step per active status", () => {
    expect(nextStatus("NEW")).toBe("CONFIRMED")
    expect(nextStatus("CONFIRMED")).toBe("PREPARING")
    expect(nextStatus("PREPARING")).toBe("READY")
    expect(nextStatus("READY")).toBe("COMPLETED")
    expect(nextStatus("COMPLETED")).toBeNull()
    expect(nextStatus("CANCELLED")).toBeNull()
  })

  const legal: Array<[OrderStatus, OrderStatus]> = [
    ["NEW", "CONFIRMED"],
    ["CONFIRMED", "PREPARING"],
    ["PREPARING", "READY"],
    ["READY", "COMPLETED"],
    ["NEW", "CANCELLED"],
    ["CONFIRMED", "CANCELLED"],
    ["PREPARING", "CANCELLED"],
    ["READY", "CANCELLED"],
  ]

  it("accepts every legal edge", () => {
    for (const [from, to] of legal) expect(isValidTransition(from, to), `${from}→${to}`).toBe(true)
  })

  it("rejects every other edge (skips, reversals, terminal exits, self-loops)", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const isLegal = legal.some(([f, t]) => f === from && t === to)
        expect(isValidTransition(from, to), `${from}→${to}`).toBe(isLegal)
      }
    }
    expect(isValidTransition("NEW", "READY")).toBe(false)
    expect(isValidTransition("READY", "PREPARING")).toBe(false)
    expect(isValidTransition("COMPLETED", "CANCELLED")).toBe(false)
    expect(isValidTransition("CANCELLED", "NEW")).toBe(false)
  })

  it("marks completed and cancelled as terminal", () => {
    expect(isTerminal("COMPLETED")).toBe(true)
    expect(isTerminal("CANCELLED")).toBe(true)
    expect(isTerminal("READY")).toBe(false)
  })
})

describe("role rules", () => {
  const staff: UserRole[] = ["ADMIN", "CASHIER"]

  it("lets cashier and admin perform every legal transition", () => {
    for (const role of staff) {
      expect(canTransition("NEW", "CONFIRMED", role)).toBe(true)
      expect(canTransition("READY", "COMPLETED", role)).toBe(true)
      expect(canTransition("PREPARING", "CANCELLED", role)).toBe(true)
    }
  })

  it("limits the kitchen to start preparing and mark ready", () => {
    expect(canTransition("CONFIRMED", "PREPARING", "KITCHEN")).toBe(true)
    expect(canTransition("PREPARING", "READY", "KITCHEN")).toBe(true)
    expect(canTransition("NEW", "CONFIRMED", "KITCHEN")).toBe(false)
    expect(canTransition("READY", "COMPLETED", "KITCHEN")).toBe(false)
    expect(canTransition("CONFIRMED", "CANCELLED", "KITCHEN")).toBe(false)
  })

  it("never allows an illegal edge, whatever the role", () => {
    for (const role of ["ADMIN", "CASHIER", "KITCHEN"] as UserRole[]) {
      expect(canTransition("NEW", "COMPLETED", role)).toBe(false)
      expect(canTransition("COMPLETED", "NEW", role)).toBe(false)
    }
  })
})
