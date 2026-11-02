import "server-only"

import { db } from "@/lib/db"
import { MomoError, requestToPay } from "@/lib/momo/client"
import type { MomoConfig } from "@/lib/momo/config"
import { BRAND_NAME } from "@/lib/site"

import { PROVIDER } from "./settle"

export type PromptResult = { ok: true; attemptId: string } | { ok: false; error: MomoError["code"] }

/**
 * Record a PaymentAttempt and ask MTN to show the "enter your PIN" prompt.
 * Shared by checkout (the prompt goes out the moment the guest taps Pay),
 * the counter POS and "send again". A failed send keeps its row as FAILED,
 * so the guest sees why and can retry.
 */
export async function sendMomoPrompt(
  config: MomoConfig,
  input: { paymentId: string; orderNumber: number; amount: number; payer: string }
): Promise<PromptResult> {
  const attempt = await db.paymentAttempt.create({
    data: { paymentId: input.paymentId, provider: PROVIDER, referenceId: crypto.randomUUID(), payerPhone: input.payer, amount: input.amount },
    select: { id: true, referenceId: true },
  })
  try {
    await requestToPay(config, {
      referenceId: attempt.referenceId,
      amount: input.amount,
      payer: input.payer,
      externalId: String(input.orderNumber),
      message: `${BRAND_NAME} order ${input.orderNumber}`,
    })
  } catch (error) {
    const code = error instanceof MomoError ? error.code : "MOMO_UNAVAILABLE"
    if (!(error instanceof MomoError)) console.error("[momo] request to pay failed", error)
    await db.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", reason: code } })
    return { ok: false, error: code }
  }
  return { ok: true, attemptId: attempt.id }
}
