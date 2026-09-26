"use client"

import { Minus, Plus, Trash2 } from "lucide-react"

import { Price } from "@/components/atom/price"
import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { formatRwf } from "@/lib/order/money"
import { MAX_QUANTITY } from "@/lib/order/pricing"
import { cn } from "@/lib/utils"

import type { ResolvedLine } from "./types"
import { useCart } from "./use-cart"

/** Editable cart lines (cart page) or a compact read-only list (checkout). */
export function CartLines({ resolved, editable = true }: { resolved: ResolvedLine[]; editable?: boolean }) {
  const dict = useDictionary()
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)

  return (
    <ul className="divide-y">
      {resolved.map(({ line, item, options, unitPrice, modifiersTotal, lineTotal, unavailable }) => (
        <li key={line.key} className={cn("flex gap-3 py-4", unavailable && "opacity-60")} data-testid="cart-line">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-foreground">
                {editable ? null : <span className="tabular-nums">{line.quantity}× </span>}
                <bdi>{item?.name ?? "—"}</bdi>
              </p>
              <Price amount={lineTotal} className="font-semibold text-foreground" />
            </div>
            {options.length > 0 && (
              <p dir="auto" className="text-start text-sm">
                {options.map((o) => o.name).join(", ")}
              </p>
            )}
            {line.note && (
              <p className="text-sm italic">
                {dict?.cart?.note ?? "Note"}: {line.note}
              </p>
            )}
            {unavailable ? (
              <p className="text-sm font-medium text-destructive">{dict?.order?.soldOut ?? "Sold out"}</p>
            ) : (
              editable && (
                <p className="text-xs">
                  {interpolate(dict?.cart?.each ?? "{price} each", { price: formatRwf(unitPrice + modifiersTotal) })}
                </p>
              )
            )}
            {editable && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center rounded-full border">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-full px-0"
                    disabled={line.quantity <= 1 || unavailable}
                    onClick={() => setQuantity(line.key, line.quantity - 1)}
                    aria-label={dict?.order?.decrease ?? "Decrease quantity"}
                  >
                    <Minus />
                  </Button>
                  <span className="w-7 text-center font-semibold tabular-nums" aria-live="polite">
                    {line.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-full px-0"
                    disabled={line.quantity >= MAX_QUANTITY || unavailable}
                    onClick={() => setQuantity(line.key, line.quantity + 1)}
                    aria-label={dict?.order?.increase ?? "Increase quantity"}
                  >
                    <Plus />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="ms-auto text-muted-foreground" onClick={() => remove(line.key)}>
                  <Trash2 />
                  {dict?.cart?.remove ?? "Remove"}
                </Button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
