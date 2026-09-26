"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { useDictionary } from "@/components/internationalization/use-dictionary";
import { cn } from "@/lib/utils";

import { CardTitle } from "./card-title";
import { ItemSheet } from "./item-sheet";
import { SpecialOfferBadge } from "./special-offer-badge";
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
  // One grid in the menu's own order (sortOrder is global — see
  // scripts/process-item-photos.ts MENU_ORDER); category order breaks ties.
  const items = menu.categories
    .flatMap((c) => c.items)
    .sort((a, b) => a.sortOrder - b.sortOrder);

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

/** Items that wear the "Special offer" seal (Figma node 1355:312). */
const SPECIAL_OFFER_ITEMS = new Set(["special-charles-burger"]);

/**
 * White card with the picture and text inside it (Apple store product card):
 * transparent cut-out on white, a small "New" / "Sold out" label (a design
 * badge replaces "New"), then name and price as one two-line run. No hover
 * zoom; the whole card is the tap target.
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
  const badge = SPECIAL_OFFER_ITEMS.has(item.slug);

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
        <span className="absolute inset-[8%] block">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt=""
              fill
              priority={priority}
              sizes="(max-width: 1024px) 40vw, 200px"
              className="object-contain"
            />
          ) : (
            <Image
              src="/logo.png"
              alt=""
              width={96}
              height={96}
              className="absolute inset-0 m-auto size-1/2 object-contain"
            />
          )}
        </span>
        {badge && (
          <SpecialOfferBadge
            top={dict?.order?.specialOffer?.top}
            bottom={dict?.order?.specialOffer?.bottom}
            className="absolute start-[6%] top-[14%] size-[28%]"
          />
        )}
      </span>
      <span className="mt-2 flex flex-1 flex-col gap-0.5">
        {!item.isAvailable ? (
          <span className="text-xs font-medium text-muted-foreground">
            {dict?.order?.soldOut ?? "Sold out"}
          </span>
        ) : item.isNew && !badge ? (
          <span className="text-xs font-medium text-primary">
            {dict?.order?.new ?? "New"}
          </span>
        ) : null}
        {/* Figma menu sheet: name and price as one run — "Classic Beef
            Burger - 3,000 R₣" — clamped to two lines, start-aligned. */}
        <CardTitle name={item.name} price={item.price} />
      </span>
    </button>
  );
}
