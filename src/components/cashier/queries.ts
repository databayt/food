import "server-only"

import type { Locale } from "@/components/internationalization/config"
import { db } from "@/lib/db"
import { snapshotName } from "@/lib/order/localize"
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from "@/lib/order/status"
import { startOfTodayKigali } from "@/lib/site"

import type { CashierOrder, QueueItem } from "./types"

const itemSelect = {
  orderBy: { sortOrder: "asc" },
  select: {
    id: true,
    names: true,
    quantity: true,
    note: true,
    modifiers: { select: { optionNames: true } },
  },
} as const

export function toQueueItems(
  items: { id: string; names: unknown; quantity: number; note: string | null; modifiers: { optionNames: unknown }[] }[],
  locale: Locale
): QueueItem[] {
  return items.map((i) => ({
    id: i.id,
    name: snapshotName(i.names, locale),
    quantity: i.quantity,
    note: i.note,
    modifiers: i.modifiers.map((m) => snapshotName(m.optionNames, locale)),
  }))
}

/** Active orders (oldest first) plus today's completed/cancelled ones. */
export async function getCashierQueue(locale: Locale): Promise<CashierOrder[]> {
  const orders = await db.order.findMany({
    where: {
      OR: [
        { status: { in: [...ACTIVE_STATUSES] } },
        { status: { in: [...TERMINAL_STATUSES] }, updatedAt: { gte: startOfTodayKigali() } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      number: true,
      status: true,
      fulfillment: true,
      createdAt: true,
      customerName: true,
      customerPhone: true,
      deliveryAddress: true,
      note: true,
      total: true,
      cancelReason: true,
      payment: { select: { method: true, status: true, reference: true } },
      items: itemSelect,
    },
  })
  return orders.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    items: toQueueItems(o.items, locale),
  }))
}
