"use client"

import { useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { ChefGlyph } from "@/components/atom/icons"
import { transitionOrder } from "@/components/cashier/actions"
import type { KitchenOrder } from "@/components/cashier/types"
import type { Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Elapsed, LiveBadge } from "@/components/staff/elapsed"
import { useLiveQueue } from "@/components/staff/live-queue"
import { OrderItems } from "@/components/staff/order-items"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { cn } from "@/lib/utils"

import { fetchKitchenQueue } from "./actions"

/** Kitchen display: two large columns, one action per ticket. */
export function KitchenContent({ lang, initial }: { lang: Locale; initial: KitchenOrder[] }) {
  const dict = useDictionary()
  const now = useNow()
  const { orders, offline, fresh, acknowledge, refresh } = useLiveQueue(initial, () => fetchKitchenQueue(lang))
  const columns = [
    { status: "CONFIRMED" as const, title: dict?.kitchen?.toPrepare ?? "To prepare" },
    { status: "PREPARING" as const, title: dict?.kitchen?.preparing ?? "Preparing" },
  ]

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-2xl lg:text-3xl">{dict?.kitchen?.title ?? "Kitchen"}</h1>
        <LiveBadge offline={offline} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {columns.map((col) => {
          const list = orders.filter((o) => o.status === col.status)
          return (
            <section key={col.status} aria-label={col.title} className="space-y-3">
              <h2 className="flex items-center justify-between text-lg font-bold sm:text-lg lg:text-xl">
                {col.title}
                <span className="rounded-full bg-foreground px-2.5 py-0.5 text-sm tabular-nums text-background">{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed bg-background/60 px-4 py-12 text-center">
                  <ChefGlyph size={32} className="text-muted-foreground" />
                  <p className="mt-2 font-medium text-foreground">{dict?.kitchen?.empty ?? "Nothing to cook right now."}</p>
                  <p className="text-sm">{dict?.kitchen?.emptyHint}</p>
                </div>
              ) : (
                list.map((order) => (
                  <div key={order.id} onPointerDown={() => acknowledge(order.id)}>
                    <KitchenTicket order={order} now={now} isFresh={fresh.has(order.id)} onChanged={refresh} />
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

function KitchenTicket({
  order,
  now,
  isFresh,
  onChanged,
}: {
  order: KitchenOrder
  now: number
  isFresh: boolean
  onChanged: () => void
}) {
  const dict = useDictionary()
  const [pending, startTransition] = useTransition()
  const to = order.status === "CONFIRMED" ? "PREPARING" : "READY"

  const advance = () =>
    startTransition(async () => {
      try {
        const res = await transitionOrder({ orderId: order.id, from: order.status, to })
        if (!res.success) toast.error((dict?.errors as Record<string, string> | undefined)?.[res.error] ?? res.error)
      } catch {
        toast.error(dict?.errors?.NETWORK)
      } finally {
        onChanged()
      }
    })

  return (
    <article
      className={cn("rounded-2xl border-2 bg-card p-4", isFresh ? "border-primary" : "border-transparent shadow-xs")}
      data-testid="kitchen-order"
      data-number={order.number}
      data-status={order.status}
    >
      <header className="mb-3 flex items-baseline justify-between gap-2">
        {/* i18n-exempt — order number token */}
        <h3 className="text-3xl font-black tabular-nums sm:text-3xl lg:text-3xl">#{order.number}</h3>
        <Elapsed since={order.createdAt} now={now} className="text-sm" />
      </header>
      <OrderItems items={order.items} large />
      {order.note && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-base font-medium text-amber-900">{order.note}</p>}
      <Button size="lg" className="mt-4 h-14 w-full rounded-xl text-lg" disabled={pending} onClick={advance} data-testid="kitchen-action">
        {pending && <Loader2 className="animate-spin" />}
        {(dict?.cashier?.actions as Record<string, string> | undefined)?.[to] ?? to}
      </Button>
    </article>
  )
}
