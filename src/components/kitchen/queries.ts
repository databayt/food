import "server-only"

import { toQueueItems } from "@/components/cashier/queries"
import type { KitchenOrder } from "@/components/cashier/types"
import type { Locale } from "@/components/internationalization/config"
import { db } from "@/lib/db"

/**
 * Kitchen display data. The `select` IS the privacy boundary: customer name,
 * phone, address, payment and totals are never read for this screen. Pickup
 * vs delivery is — the kitchen packs a delivery for the ride.
 */
export async function getKitchenQueue(locale: Locale): Promise<KitchenOrder[]> {
  const orders = await db.order.findMany({
    where: { status: { in: ["CONFIRMED", "PREPARING"] } },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      fulfillment: true,
      createdAt: true,
      note: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, names: true, quantity: true, note: true, modifiers: { select: { optionNames: true } } },
      },
    },
  })
  return orders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString(), items: toQueueItems(o.items, locale) }))
}
