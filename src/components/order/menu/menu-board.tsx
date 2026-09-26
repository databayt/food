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

      <div ref={listRef} id="menu" data-menu-ready="false" className="mx-auto max-w-5xl scroll-mt-28 space-y-10 px-4 py-6">
        {menu.categories.map((category) => (
          <section key={category.id} id={`cat-${category.slug}`} aria-labelledby={`h-${category.slug}`} className="scroll-mt-32">
            <h2 id={`h-${category.slug}`} dir="auto" className="mb-4 text-start text-xl font-bold sm:text-2xl lg:text-2xl">
              {category.name}
            </h2>
            {/* mkan listings grid: 2-up on phones, 4-up on laptops. */}
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
              {category.items.map((item, index) => (
                <li key={item.id}>
                  <MenuItemCard
                    item={item}
                    canOrder={canOrder}
                    priority={index < 2 && category === menu.categories[0]}
                    onOpen={() => open(item)}
                    onQuickAdd={() => quickAdd(item)}
                  />
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

/**
 * mkan listing card (components/listings/property/card.tsx): a 4:3 rounded
 * picture with a pill badge at the top start and a round action at the top
 * end, then a truncated title, a muted line and an underlined price.
 * Item photos are transparent cut-outs, so they sit on the muted ground.
 */
function MenuItemCard({
  item,
  canOrder,
  priority,
  onOpen,
  onQuickAdd,
}: {
  item: MenuItemView
  canOrder: boolean
  priority: boolean
  onOpen: () => void
  onQuickAdd: () => void
}) {
  const dict = useDictionary()
  const orderable = canOrder && item.isAvailable
  const badge = !item.isAvailable ? (dict?.order?.soldOut ?? "Sold out") : item.isNew ? (dict?.order?.new ?? "New") : null

  return (
    <div className={cn("group relative", !item.isAvailable && "opacity-60")} data-testid="menu-item" data-item={item.slug}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!orderable}
        className="block w-full text-start after:absolute after:inset-0 disabled:cursor-default"
        aria-label={item.name}
      >
        <span className="relative mb-3 block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt=""
              fill
              priority={priority}
              sizes="(max-width: 1024px) 50vw, 240px"
              className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <Image src="/logo.png" alt="" width={96} height={96} className="absolute inset-0 m-auto size-[42%] object-contain opacity-90" />
          )}
        </span>
        <span className="block space-y-0.5">
          <span dir="auto" className="block truncate text-sm font-medium text-foreground">
            {item.name}
          </span>
          {item.description && (
            <span dir="auto" className="block truncate text-sm text-muted-foreground">
              {item.description}
            </span>
          )}
          <Price amount={item.price} className="block text-sm font-semibold text-foreground underline underline-offset-2" />
        </span>
      </button>

      {badge && (
        <span className="pointer-events-none absolute start-3 top-3 rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
          {badge}
        </span>
      )}
      {orderable && (
        <button
          type="button"
          onClick={onQuickAdd}
          className="absolute end-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-background text-foreground shadow-md transition-transform active:scale-95"
          aria-label={`${dict?.order?.add ?? "Add"} ${item.name}`}
          data-testid="quick-add"
        >
          <Plus className="size-5" />
        </button>
      )}
    </div>
  )
}
