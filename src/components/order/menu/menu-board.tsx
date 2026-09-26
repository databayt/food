"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Price } from "@/components/atom/price"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { cn } from "@/lib/utils"

import { useCart } from "../cart/use-cart"
import { ItemSheet } from "./item-sheet"
import type { MenuItemView, MenuView } from "./types"

/**
 * The interactive menu: sticky scroll-spy category chips, item rows, and the
 * item sheet. Items without required choices get a one-tap "+" add.
 */
export function MenuBoard({ menu, canOrder }: { menu: MenuView; canOrder: boolean }) {
  const dict = useDictionary()
  const add = useCart((s) => s.add)
  const [active, setActive] = useState(menu.categories[0]?.slug ?? "")
  const [sheetItem, setSheetItem] = useState<MenuItemView | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const chipsRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Hydration marker: interactive from here on (used by slow-network e2e).
  useEffect(() => {
    listRef.current?.setAttribute("data-menu-ready", "true")
  }, [])

  useEffect(() => {
    const sections = menu.categories
      .map((c) => document.getElementById(`cat-${c.slug}`))
      .filter((el): el is HTMLElement => !!el)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const first = visible[0]
        if (first) setActive(first.target.id.replace(/^cat-/, ""))
      },
      { rootMargin: "-120px 0px -60% 0px" }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [menu.categories])

  useEffect(() => {
    chipsRef.current
      ?.querySelector<HTMLElement>(`[data-slug="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
  }, [active])

  const open = (item: MenuItemView) => {
    setSheetItem(item)
    setSheetOpen(true)
  }

  const quickAdd = (item: MenuItemView) => {
    if (item.modifierGroups.some((g) => g.minSelect > 0)) return open(item)
    add({ itemId: item.id, optionIds: [], quantity: 1, note: "" })
    toast.success(dict?.order?.added ?? "Added to your order", { duration: 1500 })
  }

  if (menu.categories.length === 0) {
    return <p className="px-4 py-16 text-center">{dict?.order?.emptyMenu ?? "The menu is being updated."}</p>
  }

  return (
    <>
      <nav
        aria-label={dict?.order?.categories ?? "Menu categories"}
        className="sticky top-14 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div ref={chipsRef} className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
          {menu.categories.map((c) => (
            <a
              key={c.id}
              href={`#cat-${c.slug}`}
              data-slug={c.slug}
              aria-current={active === c.slug ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active === c.slug ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted"
              )}
            >
              <bdi>{c.name}</bdi>
            </a>
          ))}
        </div>
      </nav>

      <div ref={listRef} data-menu-ready="false" className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {menu.categories.map((category) => (
          <section key={category.id} id={`cat-${category.slug}`} aria-labelledby={`h-${category.slug}`} className="scroll-mt-32">
            <h2 id={`h-${category.slug}`} dir="auto" className="mb-3 text-start text-xl font-bold sm:text-2xl lg:text-2xl">
              {category.name}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {category.items.map((item) => (
                <li key={item.id}>
                  <MenuItemCard item={item} canOrder={canOrder} onOpen={() => open(item)} onQuickAdd={() => quickAdd(item)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <ItemSheet item={sheetItem} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}

function MenuItemCard({
  item,
  canOrder,
  onOpen,
  onQuickAdd,
}: {
  item: MenuItemView
  canOrder: boolean
  onOpen: () => void
  onQuickAdd: () => void
}) {
  const dict = useDictionary()
  const orderable = canOrder && item.isAvailable
  return (
    <div
      className={cn(
        "relative flex h-full gap-3 rounded-2xl border bg-card p-3 transition-shadow",
        orderable && "hover:shadow-md",
        !item.isAvailable && "opacity-60"
      )}
      data-testid="menu-item"
      data-item={item.slug}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!orderable}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 text-start after:absolute after:inset-0 after:rounded-2xl disabled:cursor-default"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span dir="auto" className="font-semibold leading-tight">{item.name}</span>
          {item.isNew && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {dict?.order?.new ?? "New"}
            </span>
          )}
          {!item.isAvailable && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {dict?.order?.soldOut ?? "Sold out"}
            </span>
          )}
        </span>
        {item.description && (
          <span dir="auto" className="line-clamp-2 text-sm text-muted-foreground">
            {item.description}
          </span>
        )}
        <Price amount={item.price} className="mt-auto pt-1 font-semibold" />
      </button>
      <div className="relative flex shrink-0 flex-col items-end justify-between gap-2">
        {item.imageUrl && (
          <div className="relative size-20 overflow-hidden rounded-xl bg-muted">
            <Image src={item.imageUrl} alt={item.name} fill sizes="80px" className="object-cover" />
          </div>
        )}
        {orderable && (
          <button
            type="button"
            onClick={onQuickAdd}
            className={cn(
              "relative z-10 grid size-10 place-items-center rounded-full bg-foreground text-background shadow-md transition-transform active:scale-95",
              item.imageUrl ? "-mt-7 me-1" : "mt-auto"
            )}
            aria-label={`${dict?.order?.add ?? "Add"} ${item.name}`}
            data-testid="quick-add"
          >
            <Plus className="size-5" />
          </button>
        )}
      </div>
    </div>
  )
}
