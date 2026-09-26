"use client"

import { useState, useTransition } from "react"
import { Bike, Loader2, MapPin, Phone, Send, Store } from "lucide-react"
import { toast } from "sonner"

import { WhatsAppIcon } from "@/components/atom/icons"
import { Price } from "@/components/atom/price"
import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Elapsed } from "@/components/staff/elapsed"
import { OrderItems } from "@/components/staff/order-items"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ActionResponse } from "@/lib/action-response"
import { mapsUrl, orderPin } from "@/lib/order/location"
import { formatLocalPhone } from "@/lib/order/phone"
import { isTerminal, nextStatus } from "@/lib/order/status"
import { whatsAppHref } from "@/lib/order/whatsapp"
import { BRAND_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"

import { markDispatched, markPaid, refundPayment, transitionOrder } from "./actions"
import { riderMessage, shareOnWhatsApp, type RiderTemplates } from "./rider-message"
import type { CashierOrder } from "./types"

const STATUS_TONE: Record<string, string> = {
  NEW: "bg-primary text-primary-foreground",
  CONFIRMED: "bg-sky-100 text-sky-900",
  PREPARING: "bg-amber-100 text-amber-900",
  READY: "bg-emerald-100 text-emerald-900",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-destructive",
}

export function OrderCard({
  order,
  now,
  isFresh,
  onChanged,
}: {
  order: CashierOrder
  now: number
  isFresh: boolean
  onChanged: () => void
}) {
  const dict = useDictionary()
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState("")
  const [reference, setReference] = useState("")
  const next = nextStatus(order.status)
  const errorText = (code: string) => (dict?.errors as Record<string, string> | undefined)?.[code] ?? code

  const run = (action: () => Promise<ActionResponse<unknown>>, success?: string) =>
    startTransition(async () => {
      try {
        const res = await action()
        if (res.success) {
          if (success) toast.success(success)
        } else toast.error(errorText(res.error))
      } catch {
        toast.error(errorText("NETWORK"))
      } finally {
        onChanged()
      }
    })

  const advance = () =>
    next &&
    run(
      () => transitionOrder({ orderId: order.id, from: order.status, to: next }),
      interpolate(dict?.cashier?.updated ?? "Order #{number} updated", { number: order.number })
    )

  const paymentPending = order.payment?.status === "PENDING"
  const isDelivery = order.fulfillment === "DELIVERY"
  const active = !isTerminal(order.status)
  const pin = orderPin(order)
  // A READY delivery first goes out with the rider, then gets delivered.
  const awaitingRider = isDelivery && order.status === "READY" && !order.dispatchedAt
  const nextLabel =
    next === "COMPLETED"
      ? isDelivery
        ? dict?.cashier?.delivered
        : dict?.cashier?.pickedUp
      : (dict?.cashier?.actions as Record<string, string> | undefined)?.[next ?? ""]

  const dispatch = () =>
    run(
      () => markDispatched({ orderId: order.id }),
      interpolate(dict?.cashier?.dispatched ?? "Order #{number} is on the way", { number: order.number })
    )

  const customerChat = whatsAppHref(
    order.customerPhone,
    interpolate(dict?.cashier?.customerMessage, { name: order.customerName, restaurant: BRAND_NAME, number: order.number })
  )
  const riderChat =
    isDelivery && dict?.cashier?.rider
      ? shareOnWhatsApp(
          riderMessage(order, dict.cashier.rider as RiderTemplates, {
            restaurant: BRAND_NAME,
            methodLabel: order.payment ? (dict?.enums?.paymentMethod?.[order.payment.method] ?? order.payment.method) : "",
          })
        )
      : null

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-xs transition-shadow",
        isFresh && "ring-2 ring-primary",
        order.status === "CANCELLED" && "opacity-70"
      )}
      data-testid="cashier-order"
      data-number={order.number}
      data-status={order.status}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          {/* i18n-exempt — order number token */}
          <h3 className="text-2xl font-extrabold tabular-nums sm:text-2xl lg:text-2xl">#{order.number}</h3>
          <Elapsed since={order.createdAt} now={now} className="text-xs" />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE[order.status])}>
            {dict?.enums?.orderStatus?.[order.status] ?? order.status}
          </span>
          {order.payment && (
            <span
              className={cn(
                "whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
                order.payment.status === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-foreground"
              )}
            >
              {dict?.enums?.paymentMethod?.[order.payment.method]} · {dict?.enums?.paymentStatus?.[order.payment.status]}
            </span>
          )}
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-foreground">{order.customerName}</span>
        <a href={`tel:${order.customerPhone}`} className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:underline">
          <Phone className="size-3.5" />
          <bdi dir="ltr">{formatLocalPhone(order.customerPhone)}</bdi>
        </a>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {order.fulfillment === "PICKUP" ? <Store className="size-3.5" /> : <Bike className="size-3.5" />}
          {dict?.enums?.fulfillment?.[order.fulfillment]}
        </span>
      </div>
      {order.deliveryAddress && (
        <p className="mt-1 text-sm">
          <span className="font-medium text-foreground">{dict?.cashier?.address}:</span> {order.deliveryAddress}
        </p>
      )}
      {isDelivery && !pin && active && <p className="mt-1 text-xs text-amber-700">{dict?.cashier?.noPin}</p>}
      {order.dispatchedAt && order.status === "READY" && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900" data-testid="on-the-way">
          <Bike className="size-3.5" />
          {dict?.cashier?.onTheWay} · <Elapsed since={order.dispatchedAt} now={now} className="text-sky-900" />
        </p>
      )}

      {active && (
        <div className="mt-3 flex gap-1.5">
          {pin && (
            <a
              href={mapsUrl(pin.lat, pin.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-xs font-medium"
              data-testid="order-map"
            >
              <MapPin className="size-4" />
              {dict?.cashier?.map}
            </a>
          )}
          {customerChat && (
            <a
              href={customerChat}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-xs font-medium"
              data-testid="whatsapp-customer"
            >
              <WhatsAppIcon size={16} className="text-whatsapp" />
              {dict?.cashier?.whatsapp}
            </a>
          )}
          {riderChat && (
            <a
              href={riderChat}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-xs font-medium"
              data-testid="send-to-rider"
            >
              <Send className="size-4" />
              {dict?.cashier?.sendToRider}
            </a>
          )}
        </div>
      )}

      <div className="mt-3 border-t pt-3">
        <OrderItems items={order.items} />
      </div>
      {order.note && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-semibold">{dict?.cashier?.note}:</span> {order.note}
        </p>
      )}
      {order.cancelReason && <p className="mt-2 text-sm text-destructive">{order.cancelReason}</p>}

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-sm">{dict?.cart?.total ?? "Total"}</span>
        <Price amount={order.total} className="text-lg font-bold text-foreground" />
      </div>

      {awaitingRider ? (
        <Button size="lg" className="mt-3 h-12 w-full rounded-xl text-base" disabled={pending} onClick={dispatch} data-testid="dispatch-order">
          {pending ? <Loader2 className="animate-spin" /> : <Bike />}
          {dict?.cashier?.dispatch ?? "Out for delivery"}
        </Button>
      ) : (
        next && (
          <Button
            size="lg"
            className="mt-3 h-12 w-full rounded-xl text-base"
            disabled={pending}
            onClick={advance}
            data-testid="next-action"
          >
            {pending && <Loader2 className="animate-spin" />}
            {nextLabel ?? next}
          </Button>
        )
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {paymentPending && order.status !== "CANCELLED" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full" disabled={pending} data-testid="mark-paid">
                {dict?.cashier?.markPaid ?? "Mark paid"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {interpolate(dict?.cashier?.markPaidTitle ?? "Payment for order #{number}", { number: order.number })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {dict?.enums?.paymentMethod?.[order.payment!.method]} · <Price amount={order.total} />
                </AlertDialogDescription>
              </AlertDialogHeader>
              {order.payment?.method === "MOMO" && (
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={60}
                  dir="ltr"
                  placeholder={dict?.cashier?.momoReference ?? "MoMo transaction ID (optional)"}
                />
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>{dict?.common?.cancel ?? "Cancel"}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => run(() => markPaid({ orderId: order.id, reference: reference || undefined }), dict?.cashier?.paidDone)}
                  data-testid="confirm-paid"
                >
                  {dict?.cashier?.markPaid ?? "Mark paid"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {!isTerminal(order.status) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ms-auto rounded-full text-destructive" disabled={pending} data-testid="cancel-order">
                {dict?.cashier?.cancel ?? "Cancel order"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{interpolate(dict?.cashier?.cancelTitle ?? "Cancel order #{number}?", { number: order.number })}</AlertDialogTitle>
                <AlertDialogDescription>{dict?.cashier?.cancelBody}</AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder={dict?.cashier?.cancelReason ?? "Reason (optional)"}
              />
              <AlertDialogFooter>
                <AlertDialogCancel>{dict?.cashier?.keepOrder ?? "Keep order"}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() =>
                    run(() => transitionOrder({ orderId: order.id, from: order.status, to: "CANCELLED", reason: reason || undefined }))
                  }
                  data-testid="confirm-cancel"
                >
                  {dict?.cashier?.cancel ?? "Cancel order"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {order.status === "CANCELLED" && order.payment?.status === "PAID" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full" disabled={pending}>
                {dict?.cashier?.refund ?? "Mark refunded"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{interpolate(dict?.cashier?.refundTitle ?? "Refund order #{number}?", { number: order.number })}</AlertDialogTitle>
                <AlertDialogDescription>
                  <Price amount={order.total} />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{dict?.common?.cancel ?? "Cancel"}</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => refundPayment({ orderId: order.id }), dict?.cashier?.refundDone)}>
                  {dict?.cashier?.refund ?? "Mark refunded"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </article>
  )
}
