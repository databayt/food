import "server-only"

import { Prisma, type FulfillmentType, type OrderStatus, type PaymentMethod } from "@/generated/prisma/client"

import type { ResolvedOrderLine } from "@/components/order/checkout/resolve-order"
import { db } from "@/lib/db"
import { generateTrackingToken } from "@/lib/order/token"

/**
 * The one place an order row is written. Guest checkout and the counter POS
 * both come through here, so item snapshots, totals, payment and history
 * are always stored the same way, in ONE transaction.
 *
 * `stage` decides who sees the order first:
 *   AWAITING_PAYMENT  a MoMo prompt is out; no staff screen shows it until
 *                     MTN confirms the money (payment/settle.ts places it)
 *   NEW               unpaid (cash, manual MoMo): the cashier confirms it
 *   CONFIRMED         paid at the counter: straight to the kitchen
 */
export type OrderStage = Extract<OrderStatus, "AWAITING_PAYMENT" | "NEW" | "CONFIRMED">

export type NewOrder = {
  idempotencyKey: string
  locale: string
  stage: OrderStage
  fulfillment: FulfillmentType
  /** A phone links the order to a Customer row; a counter walk-in may have none. */
  customer: { name: string; phone: string | null }
  delivery: { address: string; lat: number | null; lng: number | null; accuracy: number | null } | null
  note: string | null
  lines: ResolvedOrderLine[]
  totals: { subtotal: number; deliveryFee: number; total: number }
  /** `paid` = the cashier took the money at the counter, right now. */
  payment: { method: PaymentMethod; paid?: { recordedById: string; reference: string | null } }
  /** Staff member who rang the order up (POS); null for a guest. */
  actorId?: string | null
}

const ORDER_REF = { id: true, number: true, publicToken: true, status: true, payment: { select: { id: true } } } as const
export type OrderRef = { id: string; number: number; publicToken: string; status: OrderStatus; payment: { id: string } | null }

export function findOrderByKey(idempotencyKey: string): Promise<OrderRef | null> {
  return db.order.findUnique({ where: { idempotencyKey }, select: ORDER_REF })
}

function isUniqueViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false
  const target = (error.meta as { target?: unknown } | undefined)?.target
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field)
}

/**
 * Insert the order. Two submits racing on one idempotency key both get the
 * winner; only the request that wrote it sees `created` (and sends a prompt).
 */
export async function insertOrder(input: NewOrder): Promise<OrderRef & { created: boolean }> {
  const now = new Date()
  const { stage, customer, delivery, payment, actorId = null } = input
  const statusRow = { from: null, to: stage, event: "STATUS", actorId }
  try {
    const order = await db.$transaction(async (tx) => {
      const customerRow = customer.phone
        ? await tx.customer.upsert({
            where: { phone: customer.phone },
            update: { name: customer.name, lastOrderAt: now },
            create: { phone: customer.phone, name: customer.name },
          })
        : null
      return tx.order.create({
        data: {
          publicToken: generateTrackingToken(),
          idempotencyKey: input.idempotencyKey,
          status: stage,
          placedAt: stage === "AWAITING_PAYMENT" ? null : now,
          confirmedAt: stage === "CONFIRMED" ? now : null,
          fulfillment: input.fulfillment,
          locale: input.locale,
          customerId: customerRow?.id ?? null,
          customerName: customer.name,
          customerPhone: customer.phone,
          deliveryAddress: delivery?.address ?? null,
          deliveryLat: delivery?.lat ?? null,
          deliveryLng: delivery?.lng ?? null,
          deliveryAccuracy: delivery?.accuracy ?? null,
          note: input.note || null,
          subtotal: input.totals.subtotal,
          deliveryFee: input.totals.deliveryFee,
          total: input.totals.total,
          items: {
            create: input.lines.map((line, index) => ({
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
          payment: {
            create: payment.paid
              ? {
                  method: payment.method,
                  status: "PAID",
                  amount: input.totals.total,
                  paidAt: now,
                  reference: payment.paid.reference,
                  recordedById: payment.paid.recordedById,
                }
              : { method: payment.method, status: "PENDING", amount: input.totals.total },
          },
          history: {
            create: payment.paid
              ? [statusRow, { event: "PAYMENT_PAID", actorId, note: payment.paid.reference }]
              : statusRow,
          },
        },
        select: ORDER_REF,
      })
    })
    return { ...order, created: true }
  } catch (error) {
    if (isUniqueViolation(error, "idempotencyKey")) {
      const winner = await findOrderByKey(input.idempotencyKey)
      if (winner) return { ...winner, created: false }
    }
    throw error
  }
}
