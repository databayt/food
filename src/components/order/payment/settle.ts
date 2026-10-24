import "server-only"

import type { PaymentAttemptStatus } from "@/generated/prisma/client"

import { db } from "@/lib/db"
import { getRequestToPayStatus, MomoError } from "@/lib/momo/client"
import { getMomoConfig } from "@/lib/momo/config"

/**
 * The only code path that marks a MoMo payment PAID. It always re-reads the
 * request from MTN — a callback body or a client never decides money state.
 * Safe to run concurrently: the claim and both updates are guarded by the
 * current status, so a callback racing a poll settles exactly once.
 */

export const PROVIDER = "MTN_MOMO"
/** Re-read a pending attempt at most this often. */
const RECHECK_MS = 5_000
/** MTN expires an unanswered prompt after ~5 min; give up on our side later. */
export const ATTEMPT_EXPIRY_MS = 10 * 60_000

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
    const moved = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: { status: "SUCCESSFUL", financialTransactionId: receipt },
    })
    if (moved.count !== 1) return
    const paid = await tx.payment.updateMany({
      where: { id: attempt.paymentId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), reference: receipt, provider: PROVIDER },
    })
    const payment = await tx.payment.findUnique({ where: { id: attempt.paymentId }, select: { orderId: true } })
    if (!payment) return
    if (paid.count === 1) {
      await tx.orderStatusHistory.create({
        data: { orderId: payment.orderId, event: "PAYMENT_PAID", note: receipt ? `MoMo auto · ${receipt}` : "MoMo auto" },
      })
    } else {
      // Already marked paid (cashier, or another attempt): money came in twice.
      console.warn("[momo] duplicate payment, refund needed", { orderId: payment.orderId, receipt })
      await tx.orderStatusHistory.create({
        data: { orderId: payment.orderId, event: "PAYMENT_DUPLICATE", note: receipt },
      })
    }
  })
}

/** Called from the guest's tracking poll. */
export async function refreshPendingAttempts(paymentId: string): Promise<void> {
  const attempts = await db.paymentAttempt.findMany({
    where: { paymentId, status: "PENDING" },
    select: { id: true, paymentId: true, createdAt: true },
  })
  await Promise.all(attempts.map((a) => claimAndRefresh(a)))
}

/** Called from the cashier poll, so payments settle even if the guest left. */
export async function refreshRecentPendingAttempts(): Promise<void> {
  const attempts = await db.paymentAttempt.findMany({
    where: { status: "PENDING", createdAt: { gte: new Date(Date.now() - 2 * ATTEMPT_EXPIRY_MS) } },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true, paymentId: true, createdAt: true },
  })
  await Promise.all(attempts.map((a) => claimAndRefresh(a)))
}

/** Called by the MTN callback; the body only tells us WHICH request to re-read. */
export async function refreshByReference(referenceId: string): Promise<void> {
  const attempt = await db.paymentAttempt.findUnique({
    where: { referenceId },
    select: { id: true, paymentId: true, createdAt: true },
  })
  if (attempt) await claimAndRefresh(attempt, true)
}
