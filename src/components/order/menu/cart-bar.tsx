"use client"

import { useMemo } from "react"
import Link from "next/link"

import { BagGlyph } from "@/components/atom/icons"
import { Price } from "@/components/atom/price"
import type { Locale } from "@/components/internationalization/config"
import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"

import { useCart, useCartHydrated } from "../cart/use-cart"
import { cartCount, cartSubtotal, indexMenu, resolveCart } from "../cart/util"
import type { MenuView } from "./types"

/** Sticky "View order" bar — appears once the cart has items. */
export function CartBar({ lang, menu }: { lang: Locale; menu: MenuView }) {
  const dict = useDictionary()
  const hydrated = useCartHydrated()
  const lines = useCart((s) => s.lines)
  const items = useMemo(() => indexMenu(menu), [menu])
  const count = cartCount(lines)
  if (!hydrated || count === 0) return null
  const subtotal = cartSubtotal(resolveCart(lines, items))

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <Link
        href={`/${lang}/order/cart`}
        className="mx-auto flex h-14 max-w-lg items-center gap-3 rounded-full bg-primary px-5 text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
        data-testid="cart-bar"
      >
        <span className="relative">
          <BagGlyph size={22} />
          <span className="absolute -end-2 -top-2 grid size-5 place-items-center rounded-full bg-background text-[11px] font-bold text-foreground">
            {count}
          </span>
        </span>
        <span className="flex-1 font-semibold">{dict?.order?.viewCart ?? "View order"}</span>
        <span className="sr-only">
          {count === 1 ? (dict?.order?.itemCountOne ?? "1 item") : interpolate(dict?.order?.itemCount ?? "{count} items", { count })}
        </span>
        <Price amount={subtotal} className="font-semibold" />
      </Link>
    </div>
  )
}
