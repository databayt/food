import "server-only"

import type { Locale } from "@/components/internationalization/config"
import { db } from "@/lib/db"
import { snapshotName } from "@/lib/order/localize"

import type { PosResult } from "./types"

/** One read for the POS: payment state, latest prompt, and the receipt once placed. */
export async function loadPosResult(orderId: string, locale: Locale, change: number | null = null): Promise<PosResult | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      publicToken: true,
      status: true,
      fulfillment: true,
      customerName: true,
      placedAt: true,
      subtotal: true,
      deliveryFee: true,
      total: true,
      payment: {
        select: {
          method: true,
          status: true,
          reference: true,
          attempts: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, reason: true, createdAt: true } },
        },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, names: true, quantity: true, lineTotal: true, modifiers: { select: { optionNames: true } } },
      },
    },
  })
  if (!order?.payment) return null
  const attempt = order.payment.attempts[0]
  const placed = order.placedAt !== null && order.status !== "CANCELLED"
  return {
    orderId: order.id,
    token: order.publicToken,
    number: order.number,
    status: order.status,
    fulfillment: order.fulfillment,
    total: order.total,
    payment: { method: order.payment.method, status: order.payment.status, reference: order.payment.reference },
    attempt: attempt ? { ...attempt, createdAt: attempt.createdAt.toISOString() } : null,
    change,
    receipt: placed
      ? {
          number: order.number,
          placedAt: order.placedAt!.toISOString(),
          fulfillment: order.fulfillment,
          customerName: order.customerName,
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee,
          total: order.total,
          items: order.items.map((i) => ({
            id: i.id,
            name: snapshotName(i.names, locale),
            quantity: i.quantity,
            lineTotal: i.lineTotal,
            modifiers: i.modifiers.map((m) => snapshotName(m.optionNames, locale)),
          })),
        }
      : null,
  }
}
