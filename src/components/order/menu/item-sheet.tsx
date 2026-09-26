"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Price, Priced } from "@/components/atom/price";
import { interpolate } from "@/components/internationalization/interpolate";
import { useDictionary } from "@/components/internationalization/use-dictionary";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MAX_QUANTITY } from "@/lib/order/pricing";
import { cn } from "@/lib/utils";

import { useCart } from "../cart/use-cart";
import { NOTE_PRESETS, type NoteKey } from "./option-images";
import type { MenuItemView, MenuModifierGroup, MenuOption } from "./types";

type Dict = ReturnType<typeof useDictionary>;

function groupHint(group: MenuModifierGroup, dict: Dict): string {
  if (group.minSelect === 1 && group.maxSelect === 1)
    return dict?.order?.chooseOne ?? "Choose 1";
  if (group.minSelect === 0)
    return interpolate(dict?.order?.chooseUpTo ?? "Choose up to {max}", {
      max: group.maxSelect,
    });
  return interpolate(dict?.order?.chooseBetween ?? "Choose {min} to {max}", {
    min: group.minSelect,
    max: group.maxSelect,
  });
}

/** Edge-to-edge horizontal row; the body's px-5 is bled out so tiles scroll to the sheet's edge. */
const ROW =
  "-mx-5 flex snap-x gap-2.5 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Tall, round-cornered bottom sheet to configure an item: picture + title, option rows, quick notes, quantity. */
export function ItemSheet({
  item,
  open,
  onOpenChange,
}: {
  item: MenuItemView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto h-[92dvh] max-w-lg gap-0 rounded-t-[2rem] border-t-0 p-0"
        // No focus ring on the first tile when the sheet opens; focus stays trapped inside.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          aria-hidden
          className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25"
        />
        {item && (
          <ItemForm
            key={item.id}
            item={item}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ItemForm({
  item,
  onDone,
}: {
  item: MenuItemView;
  onDone: () => void;
}) {
  const dict = useDictionary();
  const add = useCart((s) => s.add);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState<NoteKey[]>([]);
  // Preselect the first available option of every required single-choice group.
  const [selected, setSelected] = useState<string[]>(() =>
    item.modifierGroups
      .filter((g) => g.minSelect >= 1 && g.maxSelect === 1)
      .map((g) => g.options.find((o) => o.isAvailable)?.id)
      .filter((id): id is string => !!id),
  );
  const presets = NOTE_PRESETS[item.category] ?? [];

  const toggle = (group: MenuModifierGroup, optionId: string) => {
    setSelected((prev) => {
      const inGroup = group.options.map((o) => o.id);
      if (group.maxSelect === 1)
        return [...prev.filter((id) => !inGroup.includes(id)), optionId];
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
      if (prev.filter((id) => inGroup.includes(id)).length >= group.maxSelect)
        return prev;
      return [...prev, optionId];
    });
  };
  const toggleNote = (key: NoteKey) =>
    setNotes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const valid = item.modifierGroups.every((g) => {
    const count = g.options.filter((o) => selected.includes(o.id)).length;
    return count >= g.minSelect && count <= g.maxSelect;
  });
  const modifierTotal = item.modifierGroups
    .flatMap((g) => g.options)
    .filter((o) => selected.includes(o.id))
    .reduce((sum, o) => sum + o.price, 0);
  const total = (item.price + modifierTotal) * quantity;

  const submit = () => {
    if (!valid || !item.isAvailable) return;
    // The kitchen reads English, so the note carries the English labels.
    const note = presets
      .filter((p) => notes.includes(p.key))
      .map((p) => p.en)
      .join(", ");
    add({ itemId: item.id, optionIds: selected, quantity, note });
    toast.success(dict?.order?.added ?? "Added to your order");
    onDone();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="flex-row items-center gap-4 px-5 pt-3 pb-4 pe-12 text-start">
        <span className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-muted/60">
          <Image
            src={item.imageUrl ?? "/logo.png"}
            alt=""
            fill
            sizes="80px"
            className={cn("object-contain", item.imageUrl ? "p-1.5" : "p-4")}
          />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <SheetTitle
            dir="auto"
            className="text-start text-xl leading-tight font-bold"
          >
            {item.name}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {item.description ?? item.name}
          </SheetDescription>
          <Price
            amount={item.price}
            className="text-base font-semibold text-foreground"
          />
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-7 overflow-y-auto px-5 pt-2 pb-6">
        {item.modifierGroups.map((group) => (
          <OptionRow
            key={group.id}
            group={group}
            selected={selected}
            onToggle={(id) => toggle(group, id)}
            dict={dict}
          />
        ))}

        {presets.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-semibold">
              {dict?.order?.instructions ?? "Special instructions"}
            </h3>
            <div className={ROW}>
              {presets.map((p) => {
                const on = notes.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleNote(p.key)}
                    className={cn(
                      "h-9 shrink-0 snap-start rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "bg-card text-foreground",
                    )}
                  >
                    {dict?.order?.notes?.[p.key] ?? p.en}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div className="flex items-center gap-3 border-t px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          className="flex items-center rounded-full border"
          role="group"
          aria-label={dict?.order?.quantity ?? "Quantity"}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-full px-0"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label={dict?.order?.decrease ?? "Decrease quantity"}
          >
            <Minus />
          </Button>
          <span
            className="w-8 text-center font-semibold tabular-nums"
            aria-live="polite"
          >
            {quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-full px-0"
            onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
            disabled={quantity >= MAX_QUANTITY}
            aria-label={dict?.order?.increase ?? "Increase quantity"}
          >
            <Plus />
          </Button>
        </div>
        <Button
          type="button"
          size="lg"
          className="h-12 flex-1 rounded-full text-base"
          disabled={!valid || !item.isAvailable}
          onClick={submit}
          data-testid="add-to-order"
        >
          <Priced
            template={dict?.order?.addToOrder ?? "Add to order · {price}"}
            amount={total}
          />
        </Button>
      </div>
    </div>
  );
}

/**
 * One modifier group as a horizontal row. Groups with pictures (extras,
 * drinks once their photos land) get picture tiles; the rest get pills.
 */
function OptionRow({
  group,
  selected,
  onToggle,
  dict,
}: {
  group: MenuModifierGroup;
  selected: string[];
  onToggle: (optionId: string) => void;
  dict: Dict;
}) {
  const single = group.maxSelect === 1;
  const pictured = group.options.some((o) => o.imageUrl);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          <bdi>{group.name}</bdi>
        </h3>
        <span
          className={cn(
            "text-xs",
            group.minSelect > 0
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          )}
        >
          {group.minSelect > 0 && `${dict?.common?.required ?? "Required"} · `}
          {groupHint(group, dict)}
        </span>
      </div>
      <div
        className={ROW}
        role={single ? "radiogroup" : "group"}
        aria-label={group.name}
      >
        {group.options.map((option) => {
          const checked = selected.includes(option.id);
          const a11y = single
            ? { role: "radio", "aria-checked": checked }
            : { "aria-pressed": checked };
          return pictured ? (
            <button
              key={option.id}
              type="button"
              {...a11y}
              disabled={!option.isAvailable}
              onClick={() => onToggle(option.id)}
              className={cn(
                "relative flex w-28 shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-center transition-colors",
                checked ? "border-primary bg-card" : "border-transparent bg-muted/60",
                !option.isAvailable && "opacity-50",
              )}
            >
              <span className="relative block size-16">
                {option.imageUrl && (
                  <Image
                    src={option.imageUrl}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain"
                  />
                )}
              </span>
              <bdi className="line-clamp-1 text-sm font-medium">
                {option.name}
              </bdi>
              <OptionPrice option={option} dict={dict} />
              {checked && (
                <span className="absolute end-2 top-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>
          ) : (
            <button
              key={option.id}
              type="button"
              {...a11y}
              disabled={!option.isAvailable}
              onClick={() => onToggle(option.id)}
              className={cn(
                "flex h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-5 text-sm font-medium whitespace-nowrap transition-colors",
                checked
                  ? "border-foreground bg-foreground text-background"
                  : "bg-card text-foreground",
                !option.isAvailable && "opacity-50",
              )}
            >
              <bdi>{option.name}</bdi>
              <OptionPrice
                option={option}
                dict={dict}
                className={checked ? "text-background/70" : undefined}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function OptionPrice({
  option,
  dict,
  className,
}: {
  option: MenuOption;
  dict: Dict;
  className?: string;
}) {
  if (!option.isAvailable)
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {dict?.order?.soldOut ?? "Sold out"}
      </span>
    );
  if (option.price <= 0) return null;
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      + <Price amount={option.price} />
    </span>
  );
}
