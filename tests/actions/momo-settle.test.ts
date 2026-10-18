import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  attempt: { id: "a1", paymentId: "p1", referenceId: "ref-1", status: "PENDING", lastCheckedAt: null as Date | null, financialTransactionId: null as string | null },
  payment: { id: "p1", orderId: "o1", status: "PENDING", reference: null as string | null },
  history: [] as { event: string; note: string | null }[],
  mtn: { status: "SUCCESSFUL", financialTransactionId: "987654321", reason: null as string | null },
}))

vi.mock("@/lib/momo/config", () => ({
  getMomoConfig: () => ({ baseUrl: "x", targetEnv: "sandbox", subscriptionKey: "s", apiUser: "u", apiKey: "k", callbackUrl: null, currency: "EUR" }),
}))

vi.mock("@/lib/momo/client", () => ({
  MomoError: class extends Error {},
  getRequestToPayStatus: vi.fn(async () => ({ ...state.mtn })),
}))

vi.mock("@/lib/db", () => {
  const paymentAttempt = {
    findUnique: vi.fn(async () => ({ ...state.attempt, createdAt: new Date() })),
    findMany: vi.fn(async () => (state.attempt.status === "PENDING" ? [{ ...state.attempt, createdAt: new Date() }] : [])),
    updateMany: vi.fn(async ({ where, data }: { where: { status: string; OR?: unknown }; data: Record<string, unknown> }) => {
      if (where.status !== state.attempt.status) return { count: 0 }
      if (where.OR && state.attempt.lastCheckedAt && Date.now() - state.attempt.lastCheckedAt.getTime() < 5_000) return { count: 0 }
      Object.assign(state.attempt, data)
      return { count: 1 }
    }),
  }
  const payment = {
    findUnique: vi.fn(async () => ({ orderId: state.payment.orderId })),
    updateMany: vi.fn(async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
      if (where.status !== state.payment.status) return { count: 0 }
      Object.assign(state.payment, data)
      return { count: 1 }
    }),
  }
  const orderStatusHistory = {
    create: vi.fn(async ({ data }: { data: { event: string; note: string | null } }) => state.history.push(data)),
  }
  const tx = { paymentAttempt, payment, orderStatusHistory }
  return { db: { ...tx, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } }
})

import { refreshByReference, refreshPendingAttempts } from "@/components/order/payment/settle"

describe("MoMo settlement", () => {
  beforeEach(() => {
    Object.assign(state.attempt, { status: "PENDING", lastCheckedAt: null, financialTransactionId: null })
    Object.assign(state.payment, { status: "PENDING", reference: null })
    state.history = []
    state.mtn = { status: "SUCCESSFUL", financialTransactionId: "987654321", reason: null }
  })

  it("marks the payment PAID with MTN's receipt number", async () => {
    await refreshPendingAttempts("p1")
    expect(state.payment).toMatchObject({ status: "PAID", reference: "987654321", provider: "MTN_MOMO" })
    expect(state.attempt).toMatchObject({ status: "SUCCESSFUL", financialTransactionId: "987654321" })
    expect(state.history).toEqual([{ orderId: "o1", event: "PAYMENT_PAID", note: "MoMo auto · 987654321" }])
  })

  it("settles once when the callback races the poll", async () => {
    await Promise.all([refreshByReference("ref-1"), refreshPendingAttempts("p1"), refreshByReference("ref-1")])
    expect(state.history.filter((h) => h.event === "PAYMENT_PAID")).toHaveLength(1)
  })

  it("records a decline without touching the payment", async () => {
    state.mtn = { status: "REJECTED", financialTransactionId: null as unknown as string, reason: "APPROVAL_REJECTED" }
    await refreshPendingAttempts("p1")
    expect(state.attempt).toMatchObject({ status: "REJECTED", reason: "APPROVAL_REJECTED" })
    expect(state.payment.status).toBe("PENDING")
  })

  it("flags money that arrived after the cashier already marked it paid", async () => {
    state.payment.status = "PAID"
    await refreshPendingAttempts("p1")
    expect(state.history).toEqual([{ orderId: "o1", event: "PAYMENT_DUPLICATE", note: "987654321" }])
  })
})
