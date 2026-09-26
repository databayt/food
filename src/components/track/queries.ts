import "server-only"

import type { Locale } from "@/components/internationalization/config"
import { db } from "@/lib/db"
import { snapshotName } from "@/lib/order/localize"
import { TRACKING_TOKEN_PATTERN } from "@/lib/order/token"

import type { TrackedOrder } from "./types"

/**
 * Look up an order by its unguessable tracking token. The `select` is the
 * privacy boundary: phone, address and customer id are never read here.
 */
export async function getTrackedOrder(token: string, locale: Locale): Promise<TrackedOrder | null> {
  if (!TRACKING_TOKEN_PATTERN.test(token)) return null
  const order = await db.order.findUnique({
    where: { publicToken: token },
    select: {
      number: true,
      status: true,
      fulfillment: true,
      customerName: true,
      createdAt: true,
      updatedAt: true,
      dispatchedAt: true,
      subtotal: true,
      deliveryFee: true,
      total: true,
      payment: { select: { method: true, status: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          names: true,
          quantity: true,
          lineTotal: true,
          note: true,
          modifiers: { select: { optionNames: true } },
        },
      },
    },
  })
  if (!order) return null
  return {
    number: order.number,
    status: order.status,
    fulfillment: order.fulfillment,
    firstName: order.customerName.split(" ")[0] ?? "",
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    dispatchedAt: order.dispatchedAt?.toISOString() ?? null,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    payment: order.payment,
    items: order.items.map((i) => ({
      id: i.id,
      name: snapshotName(i.names, locale),
      quantity: i.quantity,
      lineTotal: i.lineTotal,
      note: i.note,
      modifiers: i.modifiers.map((m) => snapshotName(m.optionNames, locale)),
    })),
  }
}
