"use server"

import { revalidateTag } from "next/cache"

import { toLocale } from "@/components/internationalization/config"
import { resolveOrderLines } from "@/components/order/checkout/resolve-order"
import { fieldErrors } from "@/components/order/checkout/validation"
import { sendMomoPrompt } from "@/components/order/payment/prompt"
import { refreshPendingAttempts } from "@/components/order/payment/settle"
import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { getStaffSession } from "@/lib/auth"
import { MENU_TAG } from "@/lib/cache-tags"
import { db } from "@/lib/db"
import { getMomoConfig, toMomoPayer } from "@/lib/momo/config"
import { findOrderByKey, insertOrder } from "@/lib/order/create"
import { normalizeRwandaPhone } from "@/lib/order/phone"
import { computeOrderTotals } from "@/lib/order/pricing"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"
import { ROUTE_ROLES } from "@/routes"

import { loadPosResult } from "./queries"
import type { PosResult } from "./types"
import { PosOrderRefSchema, PosOrderSchema, PosTakeCashSchema } from "./validation"

async function limited(userId: string): Promise<boolean> {
  try {
    await assertRateLimit("mutation", userId)
    return false
  } catch (error) {
    if (error instanceof RateLimitError) return true
    throw error
  }
}

/**
 * Ring up a ticket at the counter. The cashier is the confirmation, so a
 * cash ticket goes straight to the kitchen (CONFIRMED): paid on the spot
 * for pickup, collected by the rider for a delivery. A MoMo ticket sends
 * the PIN prompt to the payer and waits, like guest checkout — MTN's
 * confirmation places it (payment/settle.ts).
 */
export async function createPosOrder(input: unknown): Promise<ActionResponse<PosResult>> {
  const session = await getStaffSession(ROUTE_ROLES.cashier)
  if (!session) return fail("FORBIDDEN")
  if (await limited(session.user.id)) return fail("RATE_LIMITED")

  const parsed = PosOrderSchema.safeParse(input)
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error)
    return fail(errors.lines === "EMPTY_CART" ? "EMPTY_CART" : "VALIDATION", { errors })
  }
  const data = parsed.data
  const locale = toLocale(data.locale)

  // A retry of a ticket already rung up returns it as it stands.
  const already = await findOrderByKey(data.idempotencyKey)
  if (already) {
    const result = await loadPosResult(already.id, locale)
    return result ? ok(result) : fail("NOT_FOUND")
  }

  const settings = await db.restaurant.findUnique({ where: { id: "default" } })
  const isDelivery = data.fulfillment === "DELIVERY"
  if (isDelivery && !settings?.deliveryEnabled) return fail("FULFILLMENT_DISABLED")

  const momo = data.method === "MOMO" && settings?.momoEnabled ? getMomoConfig() : null
  if (data.method === "MOMO" && !momo) return fail("MOMO_UNAVAILABLE")
  const payer = momo ? toMomoPayer(data.phone, momo.targetEnv === "sandbox") : null
  if (momo && !payer) return fail("MOMO_NUMBER_INVALID", { errors: { phone: "MOMO_NUMBER_INVALID" } })
  // The phone the rider and WhatsApp use; a sandbox test payer may not be one.
  const phone = data.phone ? normalizeRwandaPhone(data.phone) : null
  if (data.phone && !phone && !payer) return fail("VALIDATION", { errors: { phone: "PHONE_INVALID" } })
  if (isDelivery && !phone) return fail("VALIDATION", { errors: { phone: "PHONE_INVALID" } })

  const resolved = await resolveOrderLines(db, data.lines)
  if (!resolved.ok) {
    revalidateTag(MENU_TAG, { expire: 0 }) // the POS grid was stale — show the truth on refresh
    return fail(resolved.error, { details: { itemIds: resolved.itemIds } })
  }
  const totals = computeOrderTotals(
    resolved.lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity, modifierPrices: l.modifiers.map((m) => m.price) })),
    isDelivery ? (settings?.deliveryFee ?? 0) : 0
  )

  // Cash over the counter is paid now; on a delivery the rider collects it.
  const cashNow = data.method === "CASH" && !isDelivery
  if (cashNow && (data.tendered ?? 0) < totals.total) return fail("TENDER_SHORT", { errors: { tendered: "TENDER_SHORT" } })

  let order: Awaited<ReturnType<typeof insertOrder>>
  try {
    order = await insertOrder({
      idempotencyKey: data.idempotencyKey,
      locale,
      stage: momo ? "AWAITING_PAYMENT" : "CONFIRMED",
      fulfillment: data.fulfillment,
      customer: { name: data.name, phone },
      delivery: isDelivery ? { address: data.address, lat: null, lng: null, accuracy: null } : null,
      note: data.note || null,
      lines: resolved.lines,
      totals,
      payment: { method: data.method, ...(cashNow ? { paid: { recordedById: session.user.id, reference: null } } : {}) },
      actorId: session.user.id,
    })
  } catch (error) {
    console.error("[createPosOrder] failed", error)
    return fail("GENERIC")
  }

  if (momo && payer && order.created && order.payment) {
    try {
      await sendMomoPrompt(momo, { paymentId: order.payment.id, orderNumber: order.number, amount: totals.total, payer })
    } catch (error) {
      // The ticket exists either way; the wait screen offers "send again".
      console.error("[createPosOrder] prompt failed", error)
    }
  }
  const result = await loadPosResult(order.id, locale, cashNow ? (data.tendered ?? 0) - totals.total : null)
  return result ? ok(result) : fail("GENERIC")
}

/** Polled while a counter MoMo prompt is out: settles it with MTN, then reports. */
export async function fetchPosPayment(input: unknown): Promise<ActionResponse<PosResult>> {
  const session = await getStaffSession(ROUTE_ROLES.cashier)
  if (!session) return fail("FORBIDDEN")
  const parsed = PosOrderRefSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION")

  const payment = await db.payment.findUnique({ where: { orderId: parsed.data.orderId }, select: { id: true, status: true } })
  if (!payment) return fail("NOT_FOUND")
  if (payment.status === "PENDING") await refreshPendingAttempts(payment.id)
  const result = await loadPosResult(parsed.data.orderId, toLocale(parsed.data.locale))
  return result ? ok(result) : fail("NOT_FOUND")
}

/**
 * The payer can't approve (no balance, wrong phone): take cash instead. The
 * order goes to the kitchen now — paid for pickup, collected by the rider
 * for a delivery. If MTN confirms a prompt that was already out, settlement
 * records it as a duplicate to refund.
 */
export async function posTakeCash(input: unknown): Promise<ActionResponse<PosResult>> {
  const session = await getStaffSession(ROUTE_ROLES.cashier)
  if (!session) return fail("FORBIDDEN")
  if (await limited(session.user.id)) return fail("RATE_LIMITED")
  const parsed = PosTakeCashSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION")
  const { orderId, tendered } = parsed.data
  const locale = toLocale(parsed.data.locale)

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, total: true, fulfillment: true, payment: { select: { id: true } } },
  })
  if (!order?.payment) return fail("NOT_FOUND")
  const cashNow = order.fulfillment === "PICKUP"
  if (cashNow && (tendered ?? 0) < order.total) return fail("TENDER_SHORT", { errors: { tendered: "TENDER_SHORT" } })

  // Money may have landed a second ago — settle first.
  await refreshPendingAttempts(order.payment.id)
  const now = new Date()
  const moved = await db.$transaction(async (tx) => {
    const placed = await tx.order.updateMany({
      where: { id: orderId, status: "AWAITING_PAYMENT" },
      data: { status: "CONFIRMED", confirmedAt: now, placedAt: now },
    })
    if (placed.count !== 1) return false
    await tx.payment.updateMany({
      where: { orderId, status: "PENDING" },
      data: cashNow
        ? { method: "CASH", status: "PAID", paidAt: now, recordedById: session.user.id, provider: null }
        : { method: "CASH" },
    })
    await tx.orderStatusHistory.create({
      data: { orderId, from: "AWAITING_PAYMENT", to: "CONFIRMED", event: "STATUS", actorId: session.user.id, note: "CASH_INSTEAD" },
    })
    if (cashNow) await tx.orderStatusHistory.create({ data: { orderId, event: "PAYMENT_PAID", actorId: session.user.id, note: "Cash at counter" } })
    return true
  })
  if (!moved) {
    const current = await loadPosResult(orderId, locale)
    if (current?.status === "CANCELLED") return fail("INVALID_TRANSITION")
    // MTN got there first: it's paid and already in the kitchen.
    return current ? ok(current) : fail("NOT_FOUND")
  }
  const result = await loadPosResult(orderId, locale, cashNow ? (tendered ?? 0) - order.total : null)
  return result ? ok(result) : fail("GENERIC")
}

/** Drop a counter MoMo ticket that won't be paid. It never reached any screen. */
export async function posCancelPayment(input: unknown): Promise<ActionResponse<null>> {
  const session = await getStaffSession(ROUTE_ROLES.cashier)
  if (!session) return fail("FORBIDDEN")
  if (await limited(session.user.id)) return fail("RATE_LIMITED")
  const parsed = PosOrderRefSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION")
  const { orderId } = parsed.data

  const cancelled = await db.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: "AWAITING_PAYMENT" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    })
    if (moved.count !== 1) return false
    await tx.orderStatusHistory.create({
      data: { orderId, from: "AWAITING_PAYMENT", to: "CANCELLED", event: "STATUS", actorId: session.user.id, note: "UNPAID" },
    })
    return true
  })
  return cancelled ? ok(null) : fail("STALE_STATE")
}
