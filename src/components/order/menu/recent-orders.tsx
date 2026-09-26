"use client"

import { useMemo, useSyncExternalStore } from "react"
import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"

import type { Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"

import { rememberedOrdersServerSnapshot, rememberedOrdersSnapshot, subscribeRememberedOrders } from "../cart/history"
import type { RememberedOrder } from "../cart/types"
import { useCart } from "../cart/use-cart"
import { indexMenu, resolveCart } from "../cart/util"
import type { MenuView } from "./types"

/** Device-only "Your recent orders" with Track + Order again. No account. */
export function RecentOrders({ lang, menu, canOrder }: { lang: Locale; menu: MenuView; canOrder: boolean }) {
  const dict = useDictionary()
  const add = useCart((s) => s.add)
  const remembered = useSyncExternalStore(subscribeRememberedOrders, rememberedOrdersSnapshot, rememberedOrdersServerSnapshot)
  const orders = remembered.slice(0, 3)
  const items = useMemo(() => indexMenu(menu), [menu])

  if (orders.length === 0) return null

  const reorder = (order: RememberedOrder) => {
    const resolved = resolveCart(
      order.lines.map((l, i) => ({ ...l, key: String(i) })),
      items
    )
    const ok = resolved.filter((r) => !r.unavailable)
    ok.forEach((r) => add({ itemId: r.line.itemId, optionIds: r.line.optionIds, quantity: r.line.quantity, note: r.line.note }))
    if (ok.length < resolved.length) toast.warning(dict?.order?.reorderSkipped ?? "Some items are no longer available.")
    else toast.success(dict?.order?.reorderAdded ?? "Items added to your order")
  }

  return (
    <section aria-labelledby="recent-orders" className="mx-auto max-w-5xl px-4">
      <h2 id="recent-orders" className="mb-2 text-base font-semibold sm:text-base lg:text-base">
        {dict?.order?.recentOrders ?? "Your recent orders"}
      </h2>
      <ul className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {orders.map((o) => (
          <li key={o.token} className="flex shrink-0 items-center gap-2 rounded-2xl border p-2 ps-3">
            {/* i18n-exempt — order number token */}
            <span className="font-semibold tabular-nums">#{o.number}</span>
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href={`/${lang}/track/${o.token}`}>{dict?.order?.track ?? "Track"}</Link>
            </Button>
            {canOrder && (
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => reorder(o)}>
                <RotateCcw />
                {dict?.order?.orderAgain ?? "Order again"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
