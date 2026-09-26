"use client"

import { useState } from "react"
import type { OrderStatus } from "@prisma/client"

import { ReceiptGlyph } from "@/components/atom/icons"
import type { Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { LiveBadge } from "@/components/staff/elapsed"
import { useLiveQueue } from "@/components/staff/live-queue"
import { useNow } from "@/hooks/use-now"
import { cn } from "@/lib/utils"

import { fetchCashierQueue } from "./actions"
import { OrderCard } from "./order-card"
import type { CashierOrder } from "./types"

type Column = { key: OrderStatus | "DONE"; statuses: OrderStatus[] }

const COLUMNS: Column[] = [
  { key: "NEW", statuses: ["NEW"] },
  { key: "CONFIRMED", statuses: ["CONFIRMED"] },
  { key: "PREPARING", statuses: ["PREPARING"] },
  { key: "READY", statuses: ["READY"] },
  { key: "DONE", statuses: ["COMPLETED", "CANCELLED"] },
]

/**
 * Cashier queue — columns by status on large screens, tabs on phones. Each
 * card carries exactly one prominent next action.
 */
export function CashierContent({ lang, initial }: { lang: Locale; initial: CashierOrder[] }) {
  const dict = useDictionary()
  const now = useNow()
  const { orders, offline, fresh, acknowledge, refresh } = useLiveQueue(initial, () => fetchCashierQueue(lang))
  const [tab, setTab] = useState<Column["key"]>("NEW")

  const label = (key: Column["key"]) => (key === "DONE" ? (dict?.cashier?.done ?? "Done today") : (dict?.enums?.orderStatus?.[key] ?? key))
  const inColumn = (col: Column) =>
    orders
      .filter((o) => col.statuses.includes(o.status))
      .sort((a, b) => (col.key === "DONE" ? b.number - a.number : a.number - b.number))

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-2xl lg:text-3xl">{dict?.cashier?.title ?? "Orders"}</h1>
        <LiveBadge offline={offline} />
      </div>

      {/* Phone tabs */}
      <div role="tablist" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden">
        {COLUMNS.map((col) => {
          const count = inColumn(col).length
          return (
            <button
              key={col.key}
              role="tab"
              type="button"
              aria-selected={tab === col.key}
              onClick={() => setTab(col.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                tab === col.key ? "border-foreground bg-foreground text-background" : "bg-background"
              )}
              data-testid={`tab-${col.key}`}
            >
              {label(col.key)}
              <span
                className={cn(
                  "grid min-w-5 place-items-center rounded-full px-1 text-xs tabular-nums",
                  col.key === "NEW" && count > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const list = inColumn(col)
          return (
            <section key={col.key} className={cn("space-y-3", tab === col.key ? "block" : "hidden", "lg:block")} aria-label={label(col.key)}>
              <h2 className="hidden items-center justify-between text-sm font-semibold lg:flex lg:text-sm">
                {label(col.key)}
                <span className="rounded-full bg-background px-2 py-0.5 text-xs tabular-nums">{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed bg-background/60 px-4 py-10 text-center">
                  <ReceiptGlyph size={28} className="text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium text-foreground">{dict?.cashier?.empty ?? "No orders here."}</p>
                  {col.key === "NEW" && <p className="text-xs">{dict?.cashier?.emptyHint}</p>}
                </div>
              ) : (
                list.map((order) => (
                  <div key={order.id} onPointerDown={() => acknowledge(order.id)}>
                    <OrderCard order={order} now={now} isFresh={fresh.has(order.id)} onChanged={refresh} />
                  </div>
                ))
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}
