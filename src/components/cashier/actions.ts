"use server"

import { toLocale } from "@/components/internationalization/config"
import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { getStaffSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { canTransition, isValidTransition, STATUS_TIMESTAMP } from "@/lib/order/status"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"
import { sanitizeInput } from "@/lib/sanitization"
import { ROUTE_ROLES } from "@/routes"

import { getCashierQueue } from "./queries"
import type { CashierOrder } from "./types"
import { MarkPaidSchema, RefundSchema, TransitionSchema } from "./validation"

class StaleStateError extends Error {}

async function limited(userId: string): Promise<boolean> {
  try {
    await assertRateLimit("mutation", userId)
    return false
  } catch (error) {
    if (error instanceof RateLimitError) return true
    throw error
  }
}

/** Live queue for the cashier screen (polled every 5 s). */
export async function fetchCashierQueue(locale: string): Promise<ActionResponse<CashierOrder[]>> {
  const session = await getStaffSession(ROUTE_ROLES.cashier)
  if (!session) return fail("FORBIDDEN")
  return ok(await getCashierQueue(toLocale(locale)))
}

/**
 * Move an order along NEW → CONFIRMED → PREPARING → READY → COMPLETED, or to
 * CANCELLED. The state machine and role rules live in lib/order/status.ts.
 * The write is conditional on the status the staff member saw, so two people
 * tapping at once can't skip or double-apply a step (STALE_STATE).
 */
export async function transitionOrder(input: unknown): Promise<ActionResponse<{ status: string }>> {
  const session = await getStaffSession(["ADMIN", "CASHIER", "KITCHEN"])
  if (!session) return fail("FORBIDDEN")
  if (await limited(session.user.id)) return fail("RATE_LIMITED")

  const parsed = TransitionSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION")
  const { orderId, from, to } = parsed.data

  if (!isValidTransition(from, to)) return fail("INVALID_TRANSITION")
  if (!canTransition(from, to, session.user.role)) return fail("FORBIDDEN")

  const reason = to === "CANCELLED" && parsed.data.reason ? sanitizeInput(parsed.data.reason) || null : null
  const stamp = STATUS_TIMESTAMP[to]

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: from },
        data: { status: to, ...(stamp ? { [stamp]: new Date() } : {}), ...(to === "CANCELLED" ? { cancelReason: reason } : {}) },
      })
      if (updated.count !== 1) throw new StaleStateError()
      await tx.orderStatusHistory.create({
        data: { orderId, from, to, event: "STATUS", actorId: session.user.id, note: reason },
      })
    })
  } catch (error) {
    if (error instanceof StaleStateError) {
      const exists = await db.order.findUnique({ where: { id: orderId }, select: { id: true } })
      return fail(exists ? "STALE_STATE" : "NOT_FOUND")
    }
    console.error("[transitionOrder] failed", error)
    return fail("GENERIC")
  }
  return ok({ status: to })
}

/** Record a cash or MoMo payment (PENDING → PAID). Cashier/admin only. */
export async function markPaid(input: unknown): Promise<ActionResponse<null>> {
  const session = await getStaffSession(ROUTE_ROLES.cashier)
  if (!session) return fail("FORBIDDEN")
  if (await limited(session.user.id)) return fail("RATE_LIMITED")

  const parsed = MarkPaidSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION")
  const { orderId } = parsed.data
  const reference = parsed.data.reference ? sanitizeInput(parsed.data.reference) || null : null

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { orderId, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date(), reference, recordedById: session.user.id },
      })
      if (updated.count !== 1) throw new StaleStateError()
      await tx.orderStatusHistory.create({
        data: { orderId, event: "PAYMENT_PAID", actorId: session.user.id, note: reference },
      })
    })
  } catch (error) {
    if (error instanceof StaleStateError) {
      const payment = await db.payment.findUnique({ where: { orderId }, select: { status: true } })
      return fail(payment ? "ALREADY_PAID" : "NOT_FOUND")
    }
    console.error("[markPaid] failed", error)
    return fail("GENERIC")
  }
  return ok(null)
}

/** Mark a paid payment refunded — only once the order is cancelled. */
export async function refundPayment(input: unknown): Promise<ActionResponse<null>> {
  const session = await getStaffSession(ROUTE_ROLES.cashier)
  if (!session) return fail("FORBIDDEN")
  if (await limited(session.user.id)) return fail("RATE_LIMITED")

  const parsed = RefundSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION")
  const { orderId } = parsed.data

  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, payment: { select: { status: true } } } })
  if (!order?.payment) return fail("NOT_FOUND")
  if (order.status !== "CANCELLED") return fail("REFUND_REQUIRES_CANCEL")
  if (order.payment.status !== "PAID") return fail("NOT_PAID")

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { orderId, status: "PAID" },
        data: { status: "REFUNDED", refundedAt: new Date(), recordedById: session.user.id },
      })
      if (updated.count !== 1) throw new StaleStateError()
      await tx.orderStatusHistory.create({ data: { orderId, event: "PAYMENT_REFUNDED", actorId: session.user.id } })
    })
  } catch (error) {
    if (error instanceof StaleStateError) return fail("NOT_PAID")
    console.error("[refundPayment] failed", error)
    return fail("GENERIC")
  }
  return ok(null)
}
