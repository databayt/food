"use server"

import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { db } from "@/lib/db"
import { MomoError, requestToPay } from "@/lib/momo/client"
import { getMomoConfig, toMomoPayer } from "@/lib/momo/config"
import { assertRateLimit, getClientId, RateLimitError } from "@/lib/rate-limit"
import { BRAND_NAME } from "@/lib/site"

import { PROVIDER, refreshPendingAttempts } from "./settle"
import { StartMomoSchema } from "./validation"

/** A second tap within this window returns the prompt already on its way. */
const REUSE_MS = 2 * 60_000

/**
 * Send the MTN MoMo "enter your PIN" prompt for an order. Guest-callable
 * with the tracking token; the amount always comes from the order row.
 */
export async function startMomoPayment(input: unknown): Promise<ActionResponse<{ attemptId: string }>> {
  const config = getMomoConfig()
  if (!config) return fail("MOMO_UNAVAILABLE")

  const parsed = StartMomoSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message === "MOMO_NUMBER_INVALID" ? "MOMO_NUMBER_INVALID" : "NOT_FOUND")
  const { token, phone } = parsed.data

  try {
    await assertRateLimit("momo", await getClientId())
    await assertRateLimit("momo-order", token)
  } catch (error) {
    if (error instanceof RateLimitError) return fail("RATE_LIMITED", { details: { retryAfter: error.retryAfter } })
    throw error
  }

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

  const payer = toMomoPayer(phone || order.customerPhone, config.targetEnv === "sandbox")
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

  const attempt = await db.paymentAttempt.create({
    data: { paymentId: payment.id, provider: PROVIDER, referenceId: crypto.randomUUID(), payerPhone: payer, amount: payment.amount },
    select: { id: true, referenceId: true },
  })
  try {
    await requestToPay(config, {
      referenceId: attempt.referenceId,
      amount: payment.amount,
      payer,
      externalId: String(order.number),
      message: `${BRAND_NAME} #${order.number}`,
    })
  } catch (error) {
    const code = error instanceof MomoError ? error.code : "MOMO_UNAVAILABLE"
    if (!(error instanceof MomoError)) console.error("[startMomoPayment] failed", error)
    await db.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", reason: code } })
    return fail(code)
  }
  return ok({ attemptId: attempt.id })
}
