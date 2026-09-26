"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { Price } from "@/components/atom/price";
import { useDictionary } from "@/components/internationalization/use-dictionary";
import { cn } from "@/lib/utils";

import { ItemSheet } from "./item-sheet";
import type { MenuItemView, MenuView } from "./types";

/**
 * The menu: one continuous grid in category order (mkan listings grid —
 * 2-up on phones, 4-up on laptops) of white, Apple-store style cards on the
 * muted page. Tapping a card opens the item sheet.
 */
export function MenuBoard({
  menu,
  canOrder,
}: {
  menu: MenuView;
  canOrder: boolean;
}) {
  const dict = useDictionary();
  const [sheetItem, setSheetItem] = useState<MenuItemView | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const items = menu.categories.flatMap((c) => c.items);

  // Hydration marker: interactive from here on (used by slow-network e2e).
  useEffect(() => {
    listRef.current?.setAttribute("data-menu-ready", "true");
  }, []);

  const open = (item: MenuItemView) => {
    setSheetItem(item);
    setSheetOpen(true);
  };

  if (items.length === 0) {
    return (
      <p className="px-4 py-16 text-center">
        {dict?.order?.emptyMenu ?? "The menu is being updated."}
      </p>
    );
  }

  return (
    <>
      <div
        ref={listRef}
        id="menu"
        data-menu-ready="false"
        className="mx-auto max-w-5xl scroll-mt-20 px-4 py-6"
      >
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map((item, index) => (
            <li key={item.id}>
              <MenuItemCard
                item={item}
                canOrder={canOrder}
                priority={index < 2}
                onOpen={() => open(item)}
              />
            </li>
          ))}
        </ul>
      </div>

      <ItemSheet
        item={sheetItem}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}

/**
 * White card with the picture and text inside it (Apple store product card):
 * transparent cut-out on white, a small "New" / "Sold out" label, the name,
 * a muted line and the price. No hover zoom; the whole card is the tap target.
 */
function MenuItemCard({
  item,
  canOrder,
  priority,
  onOpen,
}: {
  item: MenuItemView;
  canOrder: boolean;
  priority: boolean;
  onOpen: () => void;
}) {
  const dict = useDictionary();
  const orderable = canOrder && item.isAvailable;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!orderable}
      aria-label={item.name}
      data-testid="menu-item"
      data-item={item.slug}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-3xl bg-card p-3 text-start shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow sm:p-4",
        orderable
          ? "hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          : "cursor-default opacity-60",
      )}
    >
      <span className="relative block aspect-square w-full">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 1024px) 45vw, 220px"
            className="object-contain"
          />
        ) : (
          <Image
            src="/logo.png"
            alt=""
            width={96}
            height={96}
            className="absolute inset-0 m-auto size-[46%] object-contain"
          />
        )}
      </span>
      <span className="mt-3 flex flex-1 flex-col gap-0.5">
        {!item.isAvailable ? (
          <span className="text-xs font-medium text-muted-foreground">
            {dict?.order?.soldOut ?? "Sold out"}
          </span>
        ) : item.isNew ? (
          <span className="text-xs font-medium text-primary">
            {dict?.order?.new ?? "New"}
          </span>
        ) : null}
        <span
          dir="auto"
          className="line-clamp-2 text-sm font-semibold leading-snug text-foreground"
        >
          {item.name}
        </span>
        {item.description && (
          <span dir="auto" className="truncate text-xs text-muted-foreground">
            {item.description}
          </span>
        )}
        <Price
          amount={item.price}
          className="mt-auto pt-2 text-sm font-medium text-foreground"
        />
      </span>
    </button>
  );
}
