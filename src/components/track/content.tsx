"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, CircleX, Radio, WifiOff } from "lucide-react"

import { Price } from "@/components/atom/price"
import type { Locale } from "@/components/internationalization/config"
import { localeConfig } from "@/components/internationalization/config"
import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { useVisiblePoll } from "@/hooks/use-visible-poll"
import { ORDER_FLOW, isTerminal } from "@/lib/order/status"
import { TIME_ZONE } from "@/lib/site"
import { cn } from "@/lib/utils"

import { getOrderStatus } from "./actions"
import type { TrackedOrder } from "./types"

const POLL_MS = 10_000

export function TrackContent({
  lang,
  token,
  initial,
  isNew,
  help,
}: {
  lang: Locale
  token: string
  initial: TrackedOrder
  isNew: boolean
  help: React.ReactNode
}) {
  const dict = useDictionary()
  const [order, setOrder] = useState(initial)
  const [offline, setOffline] = useState(false)

  useVisiblePoll(
    async () => {
      try {
        const res = await getOrderStatus(token, lang)
        if (res.success) setOrder(res.data)
        setOffline(false)
      } catch {
        setOffline(true)
      }
    },
    POLL_MS,
    !isTerminal(order.status)
  )

  const cancelled = order.status === "CANCELLED"
  const currentIndex = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number])
  const hintKey =
    order.status === "READY" ? (order.fulfillment === "PICKUP" ? "READY_PICKUP" : "READY_DELIVERY") : order.status
  const hint = (dict?.track?.statusHint as Record<string, string> | undefined)?.[hintKey]
  const time = new Intl.DateTimeFormat(localeConfig[lang].intl, { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(
    new Date(order.createdAt)
  )

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 pb-16 pt-6">
      {isNew && !cancelled && (
        <div className="mb-6 rounded-2xl bg-emerald-50 p-4 text-emerald-900" role="status" data-testid="order-received">
          <p className="flex items-center gap-2 text-lg font-bold text-emerald-900">
            <span className="grid size-7 place-items-center rounded-full bg-emerald-600 text-white">
              <Check className="size-4" />
            </span>
            {dict?.track?.received ?? "Order received!"}
          </p>
          <p className="mt-1 text-sm text-emerald-800">{dict?.track?.receivedHint}</p>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tabular-nums sm:text-4xl lg:text-4xl" data-testid="order-number">
            {interpolate(dict?.track?.title ?? "Order #{number}", { number: order.number })}
          </h1>
          <p className="mt-1 text-sm">{interpolate(dict?.track?.placedAt ?? "Placed at {time}", { time })}</p>
        </div>
        {!isTerminal(order.status) && (
          <span className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {offline ? <WifiOff className="size-3.5" /> : <Radio className="size-3.5 text-emerald-600" />}
            {offline ? (dict?.staff?.reconnecting ?? "Reconnecting…") : (dict?.track?.live ?? "Live updates")}
          </span>
        )}
      </div>

      <section className="mt-6 rounded-2xl border p-4" aria-live="polite" data-testid="order-status" data-status={order.status}>
        <p className="text-lg font-semibold text-foreground">{hint}</p>
        {cancelled ? (
          <p className="mt-3 flex items-center gap-2 font-medium text-destructive">
            <CircleX className="size-5" />
            {dict?.enums?.orderStatus?.CANCELLED ?? "Cancelled"}
          </p>
        ) : (
          <ol className="ms-0 mb-0 mt-4 list-none space-y-3">
            {ORDER_FLOW.map((status, index) => {
              const done = index < currentIndex || order.status === "COMPLETED"
              const current = index === currentIndex && order.status !== "COMPLETED"
              return (
                <li key={status} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold",
                      done && "border-emerald-600 bg-emerald-600 text-white",
                      current && "border-primary bg-primary text-primary-foreground",
                      !done && !current && "border-border text-muted-foreground"
                    )}
                  >
                    {done ? <Check className="size-4" /> : index + 1}
                  </span>
                  <span className={cn("font-medium", current ? "text-foreground" : done ? "text-foreground/80" : "text-muted-foreground")}>
                    {dict?.enums?.orderStatus?.[status] ?? status}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {offline && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <WifiOff className="size-4" />
          {dict?.track?.offline}
        </p>
      )}

      <section className="mt-6 rounded-2xl border p-4">
        <h2 className="mb-2 text-lg font-semibold sm:text-lg lg:text-lg">{dict?.track?.items ?? "Items"}</h2>
        <ul className="divide-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  <span className="tabular-nums">{item.quantity}× </span>
                  {item.name}
                </p>
                {item.modifiers.length > 0 && <p className="text-sm">{item.modifiers.join(", ")}</p>}
                {item.note && <p className="text-sm italic">{item.note}</p>}
              </div>
              <Price amount={item.lineTotal} className="shrink-0" />
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t pt-3 text-sm">
          {order.deliveryFee > 0 && (
            <div className="flex justify-between">
              <dt>{dict?.cart?.deliveryFee ?? "Delivery fee"}</dt>
              <dd>
                <Price amount={order.deliveryFee} />
              </dd>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-foreground">
            <dt>{dict?.cart?.total ?? "Total"}</dt>
            <dd>
              <Price amount={order.total} />
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-muted px-3 py-1">{dict?.enums?.fulfillment?.[order.fulfillment]}</span>
          {order.payment && (
            <>
              <span className="rounded-full bg-muted px-3 py-1">{dict?.enums?.paymentMethod?.[order.payment.method]}</span>
              <span className="rounded-full bg-muted px-3 py-1">{dict?.enums?.paymentStatus?.[order.payment.status]}</span>
            </>
          )}
        </div>
      </section>

      <div className="mt-8 space-y-6">
        {help}
        <Button asChild variant="black" className="h-12 w-full rounded-full text-base">
          <Link href={`/${lang}/order`}>{dict?.common?.backToMenu ?? "Back to menu"}</Link>
        </Button>
      </div>
    </main>
  )
}
