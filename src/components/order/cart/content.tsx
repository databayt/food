"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { BagGlyph } from "@/components/atom/icons"
import { Price } from "@/components/atom/price"
import type { Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { useLocale } from "@/components/internationalization/use-locale"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import type { MenuView } from "../menu/types"
import { CartLines } from "./cart-lines"
import { useCart, useCartHydrated } from "./use-cart"
import { cartSubtotal, indexMenu, resolveCart } from "./util"

export function CartContent({ lang, menu, canOrder }: { lang: Locale; menu: MenuView; canOrder: boolean }) {
  const dict = useDictionary()
  const { isRTL } = useLocale()
  const hydrated = useCartHydrated()
  const lines = useCart((s) => s.lines)
  const items = useMemo(() => indexMenu(menu), [menu])
  const resolved = resolveCart(lines, items)
  const subtotal = cartSubtotal(resolved)
  const hasBlocking = resolved.some((r) => r.unavailable)
  const Back = isRTL ? ArrowRight : ArrowLeft

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 pb-40 pt-4">
      <Button asChild variant="ghost" size="sm" className="-ms-2 mb-2 px-2">
        <Link href={`/${lang}/order`}>
          <Back />
          {dict?.common?.backToMenu ?? "Back to menu"}
        </Link>
      </Button>
      <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-3xl">{dict?.cart?.title ?? "Your order"}</h1>

      {!hydrated ? (
        <div className="mt-6 space-y-4" aria-busy="true">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : lines.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center" data-testid="cart-empty">
          <div className="mb-6 grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
            <BagGlyph size={32} />
          </div>
          <h2 className="mb-2 text-xl font-semibold sm:text-xl lg:text-xl">{dict?.cart?.empty ?? "Your order is empty"}</h2>
          <p className="mb-6">{dict?.cart?.emptyHint ?? "Add something tasty from the menu."}</p>
          <Button asChild variant="black" className="h-11 rounded-full px-6">
            <Link href={`/${lang}/order`}>{dict?.cart?.browseMenu ?? "Browse the menu"}</Link>
          </Button>
        </div>
      ) : (
        <>
          <CartLines resolved={resolved} />
          <Button asChild variant="outline" className="mt-2 w-full rounded-full">
            <Link href={`/${lang}/order`}>{dict?.cart?.addMore ?? "Add more items"}</Link>
          </Button>
          <dl className="mt-6 space-y-2 border-t pt-4">
            <div className="flex justify-between text-lg font-bold">
              <dt>{dict?.cart?.subtotal ?? "Subtotal"}</dt>
              <dd>
                <Price amount={subtotal} />
              </dd>
            </div>
          </dl>
          {hasBlocking && <p className="mt-2 text-sm text-destructive">{dict?.errors?.ITEM_UNAVAILABLE}</p>}

          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {canOrder ? (
              <Button
                asChild={!hasBlocking}
                disabled={hasBlocking}
                size="lg"
                className="mx-auto flex h-12 w-full max-w-lg rounded-full text-base"
                data-testid="go-checkout"
              >
                {hasBlocking ? (
                  <span>{dict?.cart?.checkout ?? "Go to checkout"}</span>
                ) : (
                  <Link href={`/${lang}/order/checkout`}>{dict?.cart?.checkout ?? "Go to checkout"}</Link>
                )}
              </Button>
            ) : (
              <p className="mx-auto max-w-lg text-center text-sm font-medium">{dict?.checkout?.closed}</p>
            )}
          </div>
        </>
      )}
    </main>
  )
}
