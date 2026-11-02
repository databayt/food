"use server"

import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { db } from "@/lib/db"
import { getMomoConfig, toMomoPayer } from "@/lib/momo/config"
import { assertRateLimit, getClientId, RateLimitError } from "@/lib/rate-limit"

import { sendMomoPrompt } from "./prompt"
import { refreshPendingAttempts } from "./settle"
import { PayCashSchema, StartMomoSchema } from "./validation"

/** A second tap within this window returns the prompt already on its way. */
const REUSE_MS = 2 * 60_000

/** Per IP, plus per order for actions that push a prompt to a real phone. */
async function limited(token: string | null): Promise<{ retryAfter: number } | null> {
  try {
    await assertRateLimit("momo", await getClientId())
    if (token) await assertRateLimit("momo-order", token)
    return null
  } catch (error) {
    if (error instanceof RateLimitError) return { retryAfter: error.retryAfter }
    throw error
  }
}

/**
 * Send the MTN MoMo "enter your PIN" prompt (again) for an order — the
 * tracking page's "Send again" / "Use another number". Guest-callable with
 * the tracking token; the amount always comes from the order row.
 */
export async function startMomoPayment(input: unknown): Promise<ActionResponse<{ attemptId: string }>> {
  const config = getMomoConfig()
  if (!config) return fail("MOMO_UNAVAILABLE")

  const parsed = StartMomoSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message === "MOMO_NUMBER_INVALID" ? "MOMO_NUMBER_INVALID" : "NOT_FOUND")
  const { token, phone } = parsed.data

  const blocked = await limited(token)
  if (blocked) return fail("RATE_LIMITED", { details: blocked })

  const order = await db.order.findUnique({
    where: { publicToken: token },
    select: {
      number: true,
      status: true,
      customerPhone: true,
      payment: { select: { id: true, method: true, status: true, amount: true } },
    },
  })
  const payment = order?.payment
  if (!order || !payment || payment.method !== "MOMO") return fail("NOT_FOUND")
  if (order.status === "CANCELLED") return fail("INVALID_TRANSITION")
  if (payment.status !== "PENDING") return fail("ALREADY_PAID")

  const payer = toMomoPayer(phone || order.customerPhone || "", config.targetEnv === "sandbox")
  if (!payer) return fail("MOMO_NUMBER_INVALID")

  // Settle anything already in flight first — it may have just been paid.
  await refreshPendingAttempts(payment.id)
  const latest = await db.paymentAttempt.findFirst({
    where: { paymentId: payment.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, payerPhone: true, createdAt: true, payment: { select: { status: true } } },
  })
  if (latest?.payment.status === "PAID") return fail("ALREADY_PAID")
  if (latest?.status === "PENDING" && latest.payerPhone === payer && Date.now() - latest.createdAt.getTime() < REUSE_MS) {
    return ok({ attemptId: latest.id })
  }

  const sent = await sendMomoPrompt(config, { paymentId: payment.id, orderNumber: order.number, amount: payment.amount, payer })
  return sent.ok ? ok({ attemptId: sent.attemptId }) : fail(sent.error)
}

/**
 * The guest gives up on MoMo for an order still waiting for its PIN: the
 * order goes to the cashier as an unpaid cash order (NEW). If a prompt that
 * was already out gets approved later, settlement still records the money.
 */
export async function payCashInstead(input: unknown): Promise<ActionResponse<null>> {
  const parsed = PayCashSchema.safeParse(input)
  if (!parsed.success) return fail("NOT_FOUND")
  const { token } = parsed.data

  const blocked = await limited(null)
  if (blocked) return fail("RATE_LIMITED", { details: blocked })

  const [order, settings] = await Promise.all([
    db.order.findUnique({ where: { publicToken: token }, select: { id: true, status: true, payment: { select: { id: true } } } }),
    db.restaurant.findUnique({ where: { id: "default" }, select: { cashEnabled: true } }),
  ])
  if (!order?.payment) return fail("NOT_FOUND")
  if (!settings?.cashEnabled) return fail("PAYMENT_METHOD_DISABLED")
  if (order.status !== "AWAITING_PAYMENT") return fail(order.status === "CANCELLED" ? "INVALID_TRANSITION" : "ALREADY_PAID")

  // Money may have landed a second ago — settle first, then release.
  await refreshPendingAttempts(order.payment.id)
  const released = await db.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({
      where: { id: order.id, status: "AWAITING_PAYMENT" },
      data: { status: "NEW", placedAt: new Date() },
    })
    if (moved.count !== 1) return false
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { method: "CASH" } })
    await tx.orderStatusHistory.create({ data: { orderId: order.id, from: "AWAITING_PAYMENT", to: "NEW", event: "STATUS", note: "CASH_INSTEAD" } })
    return true
  })
  if (released) return ok(null)
  const now = await db.order.findUnique({ where: { id: order.id }, select: { status: true } })
  return fail(now?.status === "CANCELLED" ? "INVALID_TRANSITION" : "ALREADY_PAID")
}
