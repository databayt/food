import "server-only"

import type { OrderStatus, Prisma } from "@prisma/client"

import type { Locale } from "@/components/internationalization/config"
import { db } from "@/lib/db"
import { snapshotName } from "@/lib/order/localize"
import { normalizeRwandaPhone } from "@/lib/order/phone"

export const PAGE_SIZE = 25
const STATUSES: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]
const DATE = /^\d{4}-\d{2}-\d{2}$/

export type OrderFilters = { q: string; status: OrderStatus | ""; from: string; to: string; page: number }

export function parseFilters(sp: Record<string, string | string[] | undefined>): OrderFilters {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 60) : "")
  const status = str("status") as OrderStatus
  return {
    q: str("q"),
    status: STATUSES.includes(status) ? status : "",
    from: DATE.test(str("from")) ? str("from") : "",
    to: DATE.test(str("to")) ? str("to") : "",
    page: Math.max(1, Math.min(1000, Number.parseInt(str("page") || "1", 10) || 1)),
  }
}

/** Kigali is UTC+2 year-round: a calendar date's bounds in UTC. */
function kigaliDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+02:00`)
}

export async function searchOrders(f: OrderFilters) {
  const where: Prisma.OrderWhereInput = {}
  if (f.status) where.status = f.status
  if (f.from || f.to) {
    where.createdAt = {
      ...(f.from ? { gte: kigaliDayStart(f.from) } : {}),
      ...(f.to ? { lt: new Date(kigaliDayStart(f.to).getTime() + 86_400_000) } : {}),
    }
  }
  if (f.q) {
    const digits = f.q.replace(/^#/, "")
    const phone = normalizeRwandaPhone(f.q)
    where.OR = [
      { customerName: { contains: f.q, mode: "insensitive" } },
      ...(phone ? [{ customerPhone: phone }] : []),
      ...(/^\d{1,9}$/.test(digits) ? [{ number: Number(digits) }] : []),
    ]
  }
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        createdAt: true,
        customerName: true,
        status: true,
        total: true,
        fulfillment: true,
        payment: { select: { method: true, status: true } },
      },
    }),
    db.order.count({ where }),
  ])
  return { rows, total }
}

export async function getOrderDetail(id: string, locale: Locale) {
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" }, include: { modifiers: true } },
      payment: { include: { recordedBy: { select: { name: true } } } },
      history: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  })
  if (!order) return null
  return {
    ...order,
    items: order.items.map((i) => ({
      id: i.id,
      name: snapshotName(i.names, locale),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      note: i.note,
      modifiers: i.modifiers.map((m) => ({ name: snapshotName(m.optionNames, locale), price: m.price })),
    })),
  }
}
