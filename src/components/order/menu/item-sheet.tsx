"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import { Price } from "@/components/atom/price"
import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { formatRwf } from "@/lib/order/money"
import { MAX_QUANTITY } from "@/lib/order/pricing"
import { cn } from "@/lib/utils"

import { useCart } from "../cart/use-cart"
import type { MenuItemView, MenuModifierGroup } from "./types"

function groupHint(group: MenuModifierGroup, dict: ReturnType<typeof useDictionary>): string {
  if (group.minSelect === 1 && group.maxSelect === 1) return dict?.order?.chooseOne ?? "Choose 1"
  if (group.minSelect === 0) return interpolate(dict?.order?.chooseUpTo ?? "Choose up to {max}", { max: group.maxSelect })
  return interpolate(dict?.order?.chooseBetween ?? "Choose {min} to {max}", { min: group.minSelect, max: group.maxSelect })
}

/** Bottom sheet to configure an item: modifiers, quantity, note. */
export function ItemSheet({
  item,
  open,
  onOpenChange,
}: {
  item: MenuItemView | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-lg gap-0 rounded-t-2xl p-0">
        {item && <ItemForm key={item.id} item={item} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function ItemForm({ item, onDone }: { item: MenuItemView; onDone: () => void }) {
  const dict = useDictionary()
  const add = useCart((s) => s.add)
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState("")
  // Preselect the first available option of every required single-choice group.
  const [selected, setSelected] = useState<string[]>(() =>
    item.modifierGroups
      .filter((g) => g.minSelect >= 1 && g.maxSelect === 1)
      .map((g) => g.options.find((o) => o.isAvailable)?.id)
      .filter((id): id is string => !!id)
  )

  const toggle = (group: MenuModifierGroup, optionId: string) => {
    setSelected((prev) => {
      const inGroup = group.options.map((o) => o.id)
      if (group.maxSelect === 1) return [...prev.filter((id) => !inGroup.includes(id)), optionId]
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId)
      if (prev.filter((id) => inGroup.includes(id)).length >= group.maxSelect) return prev
      return [...prev, optionId]
    })
  }

  const valid = item.modifierGroups.every((g) => {
    const count = g.options.filter((o) => selected.includes(o.id)).length
    return count >= g.minSelect && count <= g.maxSelect
  })
  const modifierTotal = item.modifierGroups
    .flatMap((g) => g.options)
    .filter((o) => selected.includes(o.id))
    .reduce((sum, o) => sum + o.price, 0)
  const total = (item.price + modifierTotal) * quantity

  const submit = () => {
    if (!valid || !item.isAvailable) return
    add({ itemId: item.id, optionIds: selected, quantity, note: note.trim() })
    toast.success(dict?.order?.added ?? "Added to your order")
    onDone()
  }

  return (
    <div className="flex max-h-[92dvh] flex-col">
      <SheetHeader className="border-b p-4 pe-12 text-start">
        <SheetTitle className="text-xl font-bold">{item.name}</SheetTitle>
        {item.description ? <SheetDescription>{item.description}</SheetDescription> : <SheetDescription className="sr-only">{item.name}</SheetDescription>}
        <Price amount={item.price} className="text-base font-semibold text-foreground" />
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {item.modifierGroups.map((group) => (
          <fieldset key={group.id} className="space-y-2">
            <legend className="flex w-full items-center justify-between gap-2">
              <span className="font-semibold">{group.name}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  group.minSelect > 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {group.minSelect > 0 ? (dict?.common?.required ?? "Required") : groupHint(group, dict)}
              </span>
            </legend>
            {group.minSelect > 0 && <p className="text-sm">{groupHint(group, dict)}</p>}
            <div className="divide-y rounded-xl border">
              {group.options.map((option) => {
                const checked = selected.includes(option.id)
                const single = group.maxSelect === 1
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2",
                      !option.isAvailable && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <input
                      type={single ? "radio" : "checkbox"}
                      name={group.id}
                      className="size-5 accent-primary"
                      checked={checked}
                      disabled={!option.isAvailable}
                      onChange={() => toggle(group, option.id)}
                    />
                    <span className="flex-1">{option.name}</span>
                    {!option.isAvailable ? (
                      <span className="text-xs text-muted-foreground">{dict?.order?.soldOut ?? "Sold out"}</span>
                    ) : option.price > 0 ? (
                      <span className="text-sm text-muted-foreground">
                        + <Price amount={option.price} />
                      </span>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}

        <div className="space-y-2">
          <label htmlFor="item-note" className="font-semibold">
            {dict?.order?.instructions ?? "Special instructions"}
          </label>
          <Textarea
            id="item-note"
            value={note}
            maxLength={140}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            placeholder={dict?.order?.instructionsPlaceholder ?? "e.g. no onions"}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center rounded-full border" role="group" aria-label={dict?.order?.quantity ?? "Quantity"}>
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
          <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
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
          {interpolate(dict?.order?.addToOrder ?? "Add to order · {price}", { price: formatRwf(total) })}
        </Button>
      </div>
    </div>
  )
}
