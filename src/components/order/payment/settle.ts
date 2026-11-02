import "server-only"

import type { PaymentAttemptStatus } from "@/generated/prisma/client"

import { db } from "@/lib/db"
import { getRequestToPayStatus, MomoError } from "@/lib/momo/client"
import { getMomoConfig } from "@/lib/momo/config"

/**
 * The only code path that marks a MoMo payment PAID. It always re-reads the
 * request from MTN — a callback body or a client never decides money state.
 * Safe to run concurrently: the claim and every update are guarded by the
 * current status, so a callback racing a poll settles exactly once.
 *
 * Pay-then-place: the same transaction that records the money moves an
 * AWAITING_PAYMENT order to CONFIRMED, so it reaches the kitchen the moment
 * MTN says paid, and never before.
 */

export const PROVIDER = "MTN_MOMO"
/** Re-read a pending attempt at most this often. */
const RECHECK_MS = 5_000
/** MTN expires an unanswered prompt after ~5 min; give up on our side later. */
export const ATTEMPT_EXPIRY_MS = 10 * 60_000
/** An unpaid pay-then-place order is cancelled this long after its last prompt. */
export const UNPAID_ORDER_TTL_MS = 15 * 60_000

type AttemptRow = { id: string; paymentId: string; createdAt: Date }

/** Claim the right to re-check (one checker per window), then settle. */
async function claimAndRefresh(attempt: AttemptRow, force = false): Promise<void> {
  const config = getMomoConfig()
  if (!config) return
  const now = new Date()
  const claimed = await db.paymentAttempt.updateMany({
    where: {
      id: attempt.id,
      status: "PENDING",
      ...(force ? {} : { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - RECHECK_MS) } }] }),
    },
    data: { lastCheckedAt: now },
  })
  if (claimed.count !== 1) return

  const full = await db.paymentAttempt.findUnique({ where: { id: attempt.id }, select: { referenceId: true } })
  if (!full) return
  const expired = now.getTime() - attempt.createdAt.getTime() > ATTEMPT_EXPIRY_MS

  let result: Awaited<ReturnType<typeof getRequestToPayStatus>>
  try {
    result = await getRequestToPayStatus(config, full.referenceId)
  } catch (error) {
    if (expired) await closeAttempt(attempt.id, "TIMEOUT", error instanceof MomoError ? error.code : "EXPIRED")
    else if (!(error instanceof MomoError)) console.error("[momo] status check failed", error)
    return
  }

  if (result.status === "SUCCESSFUL") return settlePaid(attempt, result.financialTransactionId)
  if (result.status !== "PENDING") return closeAttempt(attempt.id, result.status, result.reason)
  if (expired) return closeAttempt(attempt.id, "TIMEOUT", "EXPIRED")
}

async function closeAttempt(id: string, status: Exclude<PaymentAttemptStatus, "PENDING" | "SUCCESSFUL">, reason: string | null) {
  await db.paymentAttempt.updateMany({ where: { id, status: "PENDING" }, data: { status, reason } })
}

async function settlePaid(attempt: AttemptRow, receipt: string | null): Promise<void> {
  await db.$transaction(async (tx) => {
    const now = new Date()
    const moved = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: { status: "SUCCESSFUL", financialTransactionId: receipt },
    })
    if (moved.count !== 1) return
    const paid = await tx.payment.updateMany({
      where: { id: attempt.paymentId, status: "PENDING" },
      // MoMo money, even if the guest had switched the order to cash meanwhile.
      data: { status: "PAID", paidAt: now, reference: receipt, provider: PROVIDER, method: "MOMO" },
    })
    const payment = await tx.payment.findUnique({ where: { id: attempt.paymentId }, select: { orderId: true } })
    if (!payment) return
    const orderId = payment.orderId
    if (paid.count !== 1) {
      // Already marked paid (cashier, or another attempt): money came in twice.
      console.warn("[momo] duplicate payment, refund needed", { orderId, receipt })
      await tx.orderStatusHistory.create({ data: { orderId, event: "PAYMENT_DUPLICATE", note: receipt } })
      return
    }
    await tx.orderStatusHistory.create({
      data: { orderId, event: "PAYMENT_PAID", note: receipt ? `MoMo auto · ${receipt}` : "MoMo auto" },
    })
    // Paid → placed: straight to the kitchen, no cashier confirmation needed.
    const placed = await tx.order.updateMany({
      where: { id: orderId, status: "AWAITING_PAYMENT" },
      data: { status: "CONFIRMED", confirmedAt: now, placedAt: now },
    })
    if (placed.count === 1) {
      await tx.orderStatusHistory.create({
        data: { orderId, from: "AWAITING_PAYMENT", to: "CONFIRMED", event: "STATUS", note: "MoMo paid" },
      })
    } else {
      // Paid after it expired (or was cancelled): show it to staff so they refund it.
      await tx.order.updateMany({ where: { id: orderId, placedAt: null }, data: { placedAt: now } })
    }
  })
}

/**
 * Cancel pay-then-place orders nobody paid: still AWAITING_PAYMENT, with no
 * prompt out and none sent in the last UNPAID_ORDER_TTL_MS. Lazy (no cron):
 * the cashier poll and the guest's tracking page call it. An order with a
 * PENDING prompt never expires here — settlement decides that one.
 */
export async function expireUnpaidOrders(orderId?: string): Promise<void> {
  const cutoff = new Date(Date.now() - UNPAID_ORDER_TTL_MS)
  const where = {
    ...(orderId ? { id: orderId } : {}),
    status: "AWAITING_PAYMENT" as const,
    createdAt: { lt: cutoff },
    payment: { attempts: { none: { OR: [{ status: "PENDING" as const }, { createdAt: { gte: cutoff } }] } } },
  }
  const stale = await db.order.findMany({ where, select: { id: true }, take: 20 })
  for (const { id } of stale) {
    await db.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({ where: { ...where, id }, data: { status: "CANCELLED", cancelledAt: new Date() } })
      if (moved.count === 1) {
        await tx.orderStatusHistory.create({ data: { orderId: id, from: "AWAITING_PAYMENT", to: "CANCELLED", event: "STATUS", note: "UNPAID" } })
      }
    })
  }
}

/** Called from the guest's tracking poll. */
export async function refreshPendingAttempts(paymentId: string): Promise<void> {
  const attempts = await db.paymentAttempt.findMany({
    where: { paymentId, status: "PENDING" },
    select: { id: true, paymentId: true, createdAt: true },
  })
  await Promise.all(attempts.map((a) => claimAndRefresh(a)))
}

/**
 * Called from the cashier poll, so payments settle (and paid orders reach
 * the kitchen) even after the guest closed the tab; then expires unpaid ones.
 */
export async function refreshRecentPendingAttempts(): Promise<void> {
  const attempts = await db.paymentAttempt.findMany({
    where: { status: "PENDING", createdAt: { gte: new Date(Date.now() - 2 * ATTEMPT_EXPIRY_MS) } },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true, paymentId: true, createdAt: true },
  })
  await Promise.all(attempts.map((a) => claimAndRefresh(a)))
  await expireUnpaidOrders()
}

/** Called by the MTN callback; the body only tells us WHICH request to re-read. */
export async function refreshByReference(referenceId: string): Promise<void> {
  const attempt = await db.paymentAttempt.findUnique({
    where: { referenceId },
    select: { id: true, paymentId: true, createdAt: true },
  })
  if (attempt) await claimAndRefresh(attempt, true)
}
