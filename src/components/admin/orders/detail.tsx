import Link from "next/link"

import { Price } from "@/components/atom/price"
import { localeConfig, type Locale } from "@/components/internationalization/config"
import type { Dictionary } from "@/components/internationalization/dictionaries"
import { interpolate } from "@/components/internationalization/interpolate"
import { Button } from "@/components/ui/button"
import { mapsUrl, orderPin } from "@/lib/order/location"
import { formatLocalPhone } from "@/lib/order/phone"
import { TIME_ZONE } from "@/lib/site"

import type { getOrderDetail } from "./queries"

type Detail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>

export function OrderDetail({ lang, dict, order }: { lang: Locale; dict: Dictionary; order: Detail }) {
  const fmt = new Intl.DateTimeFormat(localeConfig[lang].intl, { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE })
  const t = dict.admin.orders
  const pin = orderPin(order)
  return (
    <main id="main-content" className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ms-2 px-2">
        <Link href={`/${lang}/admin/orders`}>{t.title}</Link>
      </Button>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tabular-nums sm:text-2xl lg:text-3xl">{interpolate(dict.track.title, { number: order.number })}</h1>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">{dict.enums.orderStatus[order.status]}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-2xl border bg-background p-4 text-sm">
          <h2 className="text-base font-semibold sm:text-base lg:text-base">{t.customer}</h2>
          <p className="font-medium text-foreground">{order.customerName}</p>
          <p>
            <a href={`tel:${order.customerPhone}`}>
              <bdi dir="ltr">{formatLocalPhone(order.customerPhone)}</bdi>
            </a>
          </p>
          <p>{dict.enums.fulfillment[order.fulfillment]}</p>
          {order.deliveryAddress && <p>{order.deliveryAddress}</p>}
          {pin && (
            <p>
              <a href={mapsUrl(pin.lat, pin.lng)} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                {dict.cashier.map}
              </a>
            </p>
          )}
          {order.note && <p className="rounded bg-amber-50 px-2 py-1 text-amber-900">{order.note}</p>}
          {order.cancelReason && <p className="text-destructive">{order.cancelReason}</p>}
        </section>

        <section className="space-y-2 rounded-2xl border bg-background p-4 text-sm">
          <h2 className="text-base font-semibold sm:text-base lg:text-base">{t.payment}</h2>
          {order.payment && (
            <>
              <p className="font-medium text-foreground">
                {dict.enums.paymentMethod[order.payment.method]} · {dict.enums.paymentStatus[order.payment.status]}
              </p>
              {order.payment.reference && <p dir="ltr">{order.payment.reference}</p>}
              {order.payment.paidAt && <p>{fmt.format(order.payment.paidAt)}</p>}
            </>
          )}
        </section>
      </div>

      <section className="rounded-2xl border bg-background p-4">
        <h2 className="mb-2 text-base font-semibold sm:text-base lg:text-base">{dict.track.items}</h2>
        <ul className="divide-y">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
              <div>
                <p className="font-medium text-foreground">
                  <span className="tabular-nums">{i.quantity}× </span>
                  {i.name} · <Price amount={i.unitPrice} />
                </p>
                {i.modifiers.map((m, idx) => (
                  <p key={idx}>
                    + {m.name} (<Price amount={m.price} />)
                  </p>
                ))}
                {i.note && <p className="italic">{i.note}</p>}
              </div>
              <Price amount={i.lineTotal} className="shrink-0 font-medium" />
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t pt-2 text-sm">
          <div className="flex justify-between">
            <dt>{dict.cart.subtotal}</dt>
            <dd>
              <Price amount={order.subtotal} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>{dict.cart.deliveryFee}</dt>
            <dd>
              <Price amount={order.deliveryFee} />
            </dd>
          </div>
          <div className="flex justify-between font-bold text-foreground">
            <dt>{dict.cart.total}</dt>
            <dd>
              <Price amount={order.total} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border bg-background p-4">
        <h2 className="mb-2 text-base font-semibold sm:text-base lg:text-base">{t.history}</h2>
        <ol className="m-0 list-none space-y-2 text-sm">
          {order.history.map((h) => (
            <li key={h.id} className="flex flex-wrap justify-between gap-2">
              <span>
                <span className="font-medium text-foreground">{t.event[h.event as keyof typeof t.event] ?? h.event}</span>
                {h.to && h.event === "STATUS" && <> → {dict.enums.orderStatus[h.to]}</>}
                {h.note && <span className="text-muted-foreground"> · {h.note}</span>}
              </span>
              <span className="text-muted-foreground">
                {h.actor?.name ?? t.byCustomer} · {fmt.format(h.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
