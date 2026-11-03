"use client"

import { Price } from "@/components/atom/price"
import type { Locale } from "@/components/internationalization/config"
import { localeConfig } from "@/components/internationalization/config"
import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { formatLocalPhone } from "@/lib/order/phone"
import { TIME_ZONE } from "@/lib/site"

import type { PosResult } from "./types"

/**
 * 80 mm till receipt. Printed with window.print(); the print stylesheet
 * hides everything but `.pos-receipt`, so it works on any thermal printer
 * the tablet's browser can reach. Transitions are off in print — shadcn
 * buttons animate `visibility` and would otherwise print mid-fade — and the
 * text is pure black (grey comes out faint on thermal paper).
 */
export function Receipt({ lang, result, restaurant }: { lang: Locale; result: PosResult; restaurant: { name: string; address: string | null; phone: string | null } }) {
  const dict = useDictionary()
  const r = result.receipt
  if (!r) return null
  const when = new Intl.DateTimeFormat(localeConfig[lang].intl, { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(r.placedAt))
  const paid = result.payment.status === "PAID"

  return (
    <div className="pos-receipt hidden text-[12px] leading-snug text-black print:block" aria-hidden="true">
      {/* i18n-exempt — print stylesheet, not copy */}
      <style>{`@media print { @page { size: 80mm auto; margin: 4mm } * { transition: none !important; animation: none !important } body * { visibility: hidden } .pos-receipt, .pos-receipt * { visibility: visible; color: #000 !important } .pos-receipt { position: absolute; inset: 0 auto auto 0; width: 72mm } }`}</style>
      <p className="text-center text-[15px] font-bold">{restaurant.name}</p>
      {restaurant.address && <p className="text-center">{restaurant.address}</p>}
      {restaurant.phone && (
        <p className="text-center" dir="ltr">
          {formatLocalPhone(restaurant.phone)}
        </p>
      )}
      <p className="mt-2 flex justify-between border-t border-dashed border-black pt-1 font-bold">
        <span>{interpolate(dict?.track?.title ?? "Order #{number}", { number: r.number })}</span>
        <span dir="ltr">{when}</span>
      </p>
      <p>
        {dict?.enums?.fulfillment?.[r.fulfillment]}
        {r.customerName ? ` · ${r.customerName}` : ""}
      </p>
      <ul className="my-1 border-y border-dashed border-black py-1">
        {r.items.map((i) => (
          <li key={i.id}>
            <div className="flex justify-between gap-2">
              <span>
                {i.quantity}× <bdi>{i.name}</bdi>
              </span>
              <Price amount={i.lineTotal} />
            </div>
            {i.modifiers.length > 0 && <div className="ps-3">+ {i.modifiers.join(", ")}</div>}
          </li>
        ))}
      </ul>
      {r.deliveryFee > 0 && (
        <p className="flex justify-between">
          <span>{dict?.cart?.deliveryFee}</span>
          <Price amount={r.deliveryFee} />
        </p>
      )}
      <p className="flex justify-between text-[14px] font-bold">
        <span>{dict?.cart?.total}</span>
        <Price amount={r.total} />
      </p>
      <p className="flex justify-between">
        <span>{dict?.enums?.paymentMethod?.[result.payment.method]}</span>
        <span>{paid ? dict?.pos?.receiptPaid : dict?.pos?.receiptUnpaid}</span>
      </p>
      {result.payment.reference && (
        <p className="flex justify-between">
          <span>{dict?.track?.momoReceipt}</span>
          <span dir="ltr">{result.payment.reference}</span>
        </p>
      )}
      {result.change != null && result.change > 0 && (
        <p className="flex justify-between">
          <span>{dict?.pos?.changeLabel ?? "Change"}</span>
          <Price amount={result.change} />
        </p>
      )}
      <p className="mt-2 text-center font-bold">{dict?.pos?.receiptThanks}</p>
    </div>
  )
}
