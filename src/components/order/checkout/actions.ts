"use server"

import { Prisma } from "@prisma/client"

import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { db } from "@/lib/db"
import { computeOrderTotals } from "@/lib/order/pricing"
import { generateTrackingToken } from "@/lib/order/token"
import { assertRateLimit, getClientId, RateLimitError } from "@/lib/rate-limit"

import { resolveOrderLines } from "./resolve-order"
import { CreateOrderSchema, fieldErrors } from "./validation"

export type CreatedOrder = { number: number; token: string }

async function findByKey(idempotencyKey: string): Promise<CreatedOrder | null> {
  const existing = await db.order.findUnique({
    where: { idempotencyKey },
    select: { number: true, publicToken: true },
  })
  return existing ? { number: existing.number, token: existing.publicToken } : null
}

function isUniqueViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false
  const target = (error.meta as { target?: unknown } | undefined)?.target
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field)
}

/**
 * Guest order creation — the transactional heart of the app.
 *
 *  1. rate limit (per IP)          5. compute totals server-side (integers)
 *  2. validate (Zod; prices ignored) 6. ONE transaction: customer, order, item
 *  3. idempotency fast path           snapshots, modifiers, payment, history
 *  4. settings + current menu rows  7. duplicate key → return the same order
 */
export async function createOrder(input: unknown): Promise<ActionResponse<CreatedOrder>> {
  try {
    await assertRateLimit("order", await getClientId())
  } catch (error) {
    if (error instanceof RateLimitError) return fail("RATE_LIMITED", { details: { retryAfter: error.retryAfter } })
    throw error
  }

  const parsed = CreateOrderSchema.safeParse(input)
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error)
    return fail(errors.lines === "EMPTY_CART" ? "EMPTY_CART" : "VALIDATION", { errors })
  }
  const data = parsed.data

  const already = await findByKey(data.idempotencyKey)
  if (already) return ok(already)

  const settings = await db.restaurant.findUnique({ where: { id: "default" } })
  if (!settings?.isOpen) return fail("RESTAURANT_CLOSED")
  if (data.fulfillment === "PICKUP" ? !settings.pickupEnabled : !settings.deliveryEnabled) {
    return fail("FULFILLMENT_DISABLED")
  }
  if (data.paymentMethod === "CASH" ? !settings.cashEnabled : !settings.momoEnabled) {
    return fail("PAYMENT_METHOD_DISABLED")
  }

  const resolved = await resolveOrderLines(db, data.lines)
  if (!resolved.ok) return fail(resolved.error, { details: { itemIds: resolved.itemIds } })

  const totals = computeOrderTotals(
    resolved.lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity, modifierPrices: l.modifiers.map((m) => m.price) })),
    data.fulfillment === "DELIVERY" ? settings.deliveryFee : 0
  )

  try {
    const order = await db.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone: data.phone },
        update: { name: data.name, lastOrderAt: new Date() },
        create: { phone: data.phone, name: data.name },
      })
      return tx.order.create({
        data: {
          publicToken: generateTrackingToken(),
          idempotencyKey: data.idempotencyKey,
          status: "NEW",
          fulfillment: data.fulfillment,
          locale: data.locale,
          customerId: customer.id,
          customerName: data.name,
          customerPhone: data.phone,
          deliveryAddress: data.fulfillment === "DELIVERY" ? data.address : null,
          note: data.note || null,
          subtotal: totals.subtotal,
          deliveryFee: totals.deliveryFee,
          total: totals.total,
          items: {
            create: resolved.lines.map((line, index) => ({
              menuItemId: line.menuItemId,
              names: line.names,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              modifiersTotal: line.modifiersTotal,
              lineTotal: line.lineTotal,
              note: line.note || null,
              sortOrder: index,
              modifiers: {
                create: line.modifiers.map((m) => ({
                  modifierOptionId: m.modifierOptionId,
                  groupNames: m.groupNames,
                  optionNames: m.optionNames,
                  price: m.price,
                })),
              },
            })),
          },
          payment: { create: { method: data.paymentMethod, status: "PENDING", amount: totals.total } },
          history: { create: { from: null, to: "NEW", event: "STATUS" } },
        },
        select: { number: true, publicToken: true },
      })
    })
    return ok({ number: order.number, token: order.publicToken })
  } catch (error) {
    // Two taps raced past the fast path: the loser returns the winner's order.
    if (isUniqueViolation(error, "idempotencyKey")) {
      const winner = await findByKey(data.idempotencyKey)
      if (winner) return ok(winner)
    }
    console.error("[createOrder] failed", error)
    return fail("GENERIC")
  }
}
