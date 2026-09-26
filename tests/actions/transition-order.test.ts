import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  role: "CASHIER" as "ADMIN" | "CASHIER" | "KITCHEN" | null,
  orderStatus: "NEW" as string,
  paymentStatus: "PENDING" as string,
  history: [] as unknown[],
  exists: true,
  fulfillment: "DELIVERY" as string,
  dispatched: false,
}))

vi.mock("@/lib/auth", () => ({
  getStaffSession: vi.fn(async (roles: string[]) =>
    state.role && roles.includes(state.role) ? { user: { id: "staff-1", role: state.role } } : null
  ),
}))

vi.mock("@/lib/rate-limit", () => ({
  RateLimitError: class extends Error {},
  assertRateLimit: vi.fn(async () => {}),
}))

vi.mock("@/components/cashier/queries", () => ({ getCashierQueue: vi.fn(async () => []) }))

vi.mock("@/lib/db", () => {
  const tx = {
    order: {
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { status: string; fulfillment?: string; dispatchedAt?: null }
          data: { status?: string; dispatchedAt?: Date }
        }) => {
          if (!state.exists || where.status !== state.orderStatus) return { count: 0 }
          if (where.fulfillment && where.fulfillment !== state.fulfillment) return { count: 0 }
          if (where.dispatchedAt === null && state.dispatched) return { count: 0 }
          if (data.dispatchedAt) state.dispatched = true
          if (data.status) state.orderStatus = data.status
          return { count: 1 }
        }
      ),
    },
    payment: {
      updateMany: vi.fn(async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
        if (where.status !== state.paymentStatus) return { count: 0 }
        state.paymentStatus = data.status
        return { count: 1 }
      }),
    },
    orderStatusHistory: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        state.history.push(data)
        return data
      }),
    },
  }
  return {
    db: {
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      order: {
        findUnique: vi.fn(async () =>
          state.exists ? { id: "o1", status: state.orderStatus, payment: { status: state.paymentStatus } } : null
        ),
      },
      payment: { findUnique: vi.fn(async () => (state.exists ? { status: state.paymentStatus } : null)) },
    },
  }
})

import { markDispatched, markPaid, refundPayment, transitionOrder } from "@/components/cashier/actions"

beforeEach(() => {
  vi.clearAllMocks()
  state.role = "CASHIER"
  state.orderStatus = "NEW"
  state.paymentStatus = "PENDING"
  state.history = []
  state.exists = true
  state.fulfillment = "DELIVERY"
  state.dispatched = false
})

describe("transitionOrder", () => {
  it("walks the full flow and records history for each step", async () => {
    for (const [from, to] of [
      ["NEW", "CONFIRMED"],
      ["CONFIRMED", "PREPARING"],
      ["PREPARING", "READY"],
      ["READY", "COMPLETED"],
    ]) {
      expect(await transitionOrder({ orderId: "o1", from, to })).toEqual({ success: true, data: { status: to } })
    }
    expect(state.orderStatus).toBe("COMPLETED")
    expect(state.history).toHaveLength(4)
    expect(state.history[0]).toMatchObject({ from: "NEW", to: "CONFIRMED", actorId: "staff-1", event: "STATUS" })
  })

  it("rejects skipping a step", async () => {
    expect(await transitionOrder({ orderId: "o1", from: "NEW", to: "READY" })).toMatchObject({ error: "INVALID_TRANSITION" })
    expect(state.orderStatus).toBe("NEW")
  })

  it("rejects leaving a terminal state", async () => {
    state.orderStatus = "COMPLETED"
    expect(await transitionOrder({ orderId: "o1", from: "COMPLETED", to: "CANCELLED" })).toMatchObject({ error: "INVALID_TRANSITION" })
  })

  it("returns STALE_STATE when someone else already moved the order", async () => {
    state.orderStatus = "CONFIRMED" // screen still shows NEW
    expect(await transitionOrder({ orderId: "o1", from: "NEW", to: "CONFIRMED" })).toMatchObject({ error: "STALE_STATE" })
    expect(state.history).toHaveLength(0)
  })

  it("returns NOT_FOUND for an unknown order", async () => {
    state.exists = false
    expect(await transitionOrder({ orderId: "nope", from: "NEW", to: "CONFIRMED" })).toMatchObject({ error: "NOT_FOUND" })
  })

  it("blocks anonymous callers", async () => {
    state.role = null
    expect(await transitionOrder({ orderId: "o1", from: "NEW", to: "CONFIRMED" })).toMatchObject({ error: "FORBIDDEN" })
  })

  it("lets the kitchen prepare and mark ready, but not confirm, complete or cancel", async () => {
    state.role = "KITCHEN"
    expect(await transitionOrder({ orderId: "o1", from: "NEW", to: "CONFIRMED" })).toMatchObject({ error: "FORBIDDEN" })
    state.orderStatus = "CONFIRMED"
    expect(await transitionOrder({ orderId: "o1", from: "CONFIRMED", to: "PREPARING" })).toMatchObject({ success: true })
    expect(await transitionOrder({ orderId: "o1", from: "PREPARING", to: "CANCELLED" })).toMatchObject({ error: "FORBIDDEN" })
    expect(await transitionOrder({ orderId: "o1", from: "PREPARING", to: "READY" })).toMatchObject({ success: true })
    expect(await transitionOrder({ orderId: "o1", from: "READY", to: "COMPLETED" })).toMatchObject({ error: "FORBIDDEN" })
  })

  it("cancels with a reason and records it", async () => {
    const res = await transitionOrder({ orderId: "o1", from: "NEW", to: "CANCELLED", reason: "  Customer called  " })
    expect(res).toMatchObject({ success: true })
    expect(state.history[0]).toMatchObject({ to: "CANCELLED", note: "Customer called" })
  })
})

describe("payments", () => {
  it("marks a pending payment paid once", async () => {
    expect(await markPaid({ orderId: "o1", reference: "MP123" })).toEqual({ success: true, data: null })
    expect(state.paymentStatus).toBe("PAID")
    expect(state.history[0]).toMatchObject({ event: "PAYMENT_PAID", note: "MP123" })
    expect(await markPaid({ orderId: "o1" })).toMatchObject({ error: "ALREADY_PAID" })
  })

  it("does not let the kitchen record payments", async () => {
    state.role = "KITCHEN"
    expect(await markPaid({ orderId: "o1" })).toMatchObject({ error: "FORBIDDEN" })
  })

  it("refunds only a paid, cancelled order", async () => {
    state.paymentStatus = "PAID"
    state.orderStatus = "READY"
    expect(await refundPayment({ orderId: "o1" })).toMatchObject({ error: "REFUND_REQUIRES_CANCEL" })
    state.orderStatus = "CANCELLED"
    expect(await refundPayment({ orderId: "o1" })).toEqual({ success: true, data: null })
    expect(state.paymentStatus).toBe("REFUNDED")
    state.paymentStatus = "PENDING"
    expect(await refundPayment({ orderId: "o1" })).toMatchObject({ error: "NOT_PAID" })
  })
})

describe("markDispatched", () => {
  it("sends a ready delivery out once, keeps it READY, and records who did it", async () => {
    state.orderStatus = "READY"
    expect(await markDispatched({ orderId: "o1" })).toEqual({ success: true, data: null })
    expect(state.dispatched).toBe(true)
    expect(state.orderStatus).toBe("READY")
    expect(state.history[0]).toMatchObject({ event: "DISPATCHED", actorId: "staff-1" })
    expect(await markDispatched({ orderId: "o1" })).toMatchObject({ error: "STALE_STATE" })
    expect(state.history).toHaveLength(1)
  })

  it("refuses a delivery that isn't ready yet", async () => {
    state.orderStatus = "PREPARING"
    expect(await markDispatched({ orderId: "o1" })).toMatchObject({ error: "STALE_STATE" })
    expect(state.dispatched).toBe(false)
  })

  it("refuses a pickup order", async () => {
    state.orderStatus = "READY"
    state.fulfillment = "PICKUP"
    expect(await markDispatched({ orderId: "o1" })).toMatchObject({ error: "STALE_STATE" })
  })

  it("is for the cashier and admin, not the kitchen", async () => {
    state.orderStatus = "READY"
    state.role = "KITCHEN"
    expect(await markDispatched({ orderId: "o1" })).toMatchObject({ error: "FORBIDDEN" })
  })

  it("returns NOT_FOUND for an unknown order", async () => {
    state.exists = false
    expect(await markDispatched({ orderId: "nope" })).toMatchObject({ error: "NOT_FOUND" })
  })
})
