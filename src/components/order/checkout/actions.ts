"use server"

import { revalidateTag } from "next/cache"

import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { MENU_TAG } from "@/lib/cache-tags"
import { db } from "@/lib/db"
import { getMomoConfig, toMomoPayer } from "@/lib/momo/config"
import { findOrderByKey, insertOrder, type OrderRef } from "@/lib/order/create"
import { computeOrderTotals } from "@/lib/order/pricing"
import { assertRateLimit, getClientId, RateLimitError } from "@/lib/rate-limit"

import { sendMomoPrompt } from "../payment/prompt"
import { resolveOrderLines } from "./resolve-order"
import { CreateOrderSchema, fieldErrors } from "./validation"

/** `awaitingPayment`: a MoMo PIN prompt is on the guest's phone; the order is placed once MTN confirms. */
export type CreatedOrder = { number: number; token: string; awaitingPayment?: true }

function toCreated(order: Pick<OrderRef, "number" | "publicToken" | "status">): CreatedOrder {
  return {
    number: order.number,
    token: order.publicToken,
    ...(order.status === "AWAITING_PAYMENT" ? { awaitingPayment: true as const } : {}),
  }
}

/**
 * Guest order creation — the transactional heart of the app.
 *
 *  1. validate (Zod; prices ignored)  5. settings + current menu rows
 *  2. idempotency fast path            6. compute totals server-side (integers)
 *  3. rate limit per IP (loose)        7. ONE transaction (lib/order/create.ts)
 *  4. rate limit per phone (tight)     8. MoMo: send the PIN prompt
 *
 * Pay-then-place: with MTN Request-to-Pay configured, a MoMo order is
 * written as AWAITING_PAYMENT and the prompt goes out in this same request,
 * so the guest's last step is the PIN. No staff screen shows the order until
 * MTN confirms the money (payment/settle.ts places it, straight to the kitchen).
 */
export async function createOrder(input: unknown): Promise<ActionResponse<CreatedOrder>> {
  const parsed = CreateOrderSchema.safeParse(input)
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error)
    return fail(errors.lines === "EMPTY_CART" ? "EMPTY_CART" : "VALIDATION", { errors })
  }
  const data = parsed.data

  // A retry of an order that already exists is free — it never burns budget.
  const already = await findOrderByKey(data.idempotencyKey)
  if (already) return ok(toCreated(already))

  try {
    await assertRateLimit("order", await getClientId())
    await assertRateLimit("order-phone", data.phone)
  } catch (error) {
    if (error instanceof RateLimitError) return fail("RATE_LIMITED", { details: { retryAfter: error.retryAfter } })
    throw error
  }

  const settings = await db.restaurant.findUnique({ where: { id: "default" } })
  if (!settings?.isOpen) return fail("RESTAURANT_CLOSED")
  if (data.fulfillment === "PICKUP" ? !settings.pickupEnabled : !settings.deliveryEnabled) {
    return fail("FULFILLMENT_DISABLED")
  }
  if (data.paymentMethod === "CASH" ? !settings.cashEnabled : !settings.momoEnabled) {
    return fail("PAYMENT_METHOD_DISABLED")
  }

  // Push-to-pay: check the payer number BEFORE anything is written.
  const momo = data.paymentMethod === "MOMO" ? getMomoConfig() : null
  const payer = momo ? toMomoPayer(data.momoPhone || data.phone, momo.targetEnv === "sandbox") : null
  // The contact phone may be Airtel: the form then opens "pay from another number".
  if (momo && !payer) return fail("MOMO_NUMBER_INVALID", { errors: { momoPhone: "MOMO_NUMBER_INVALID" } })

  const isDelivery = data.fulfillment === "DELIVERY"
  const resolved = await resolveOrderLines(db, data.lines)
  if (!resolved.ok) {
    // The guest's menu was stale (cached): expire it, so the refresh shows the truth.
    revalidateTag(MENU_TAG, { expire: 0 })
    return fail(resolved.error, { details: { itemIds: resolved.itemIds } })
  }

  const totals = computeOrderTotals(
    resolved.lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity, modifierPrices: l.modifiers.map((m) => m.price) })),
    isDelivery ? settings.deliveryFee : 0
  )

  let order: Awaited<ReturnType<typeof insertOrder>>
  try {
    order = await insertOrder({
      idempotencyKey: data.idempotencyKey,
      locale: data.locale,
      stage: momo ? "AWAITING_PAYMENT" : "NEW",
      fulfillment: data.fulfillment,
      customer: { name: data.name, phone: data.phone },
      delivery: isDelivery
        ? { address: data.address, lat: data.location?.lat ?? null, lng: data.location?.lng ?? null, accuracy: data.location?.accuracy ?? null }
        : null,
      note: data.note || null,
      lines: resolved.lines,
      totals,
      payment: { method: data.paymentMethod },
    })
  } catch (error) {
    console.error("[createOrder] failed", error)
    return fail("GENERIC")
  }

  // A failed send is not fatal: the order waits, and the tracking page shows
  // why and offers "send again" or "pay cash instead".
  if (momo && payer && order.created && order.payment) {
    try {
      await sendMomoPrompt(momo, { paymentId: order.payment.id, orderNumber: order.number, amount: totals.total, payer })
    } catch (error) {
      // The order exists either way; "send again" is one tap on the next page.
      console.error("[createOrder] prompt failed", error)
    }
  }
  return ok(toCreated(order))
}
