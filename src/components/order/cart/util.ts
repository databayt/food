import { computeLine } from "@/lib/order/pricing"

import type { MenuItemView, MenuView } from "../menu/types"
import type { CartLine, ResolvedLine } from "./types"

export function indexMenu(menu: MenuView): Map<string, MenuItemView> {
  const map = new Map<string, MenuItemView>()
  for (const c of menu.categories) for (const i of c.items) map.set(i.id, i)
  return map
}

/**
 * Resolve cart lines against the current menu for DISPLAY. The server
 * recomputes everything on submit (resolve-order.ts); this mirrors that logic
 * so what the customer sees matches what they are charged.
 */
export function resolveCart(lines: CartLine[], items: Map<string, MenuItemView>): ResolvedLine[] {
  return lines.map((line) => {
    const item = items.get(line.itemId) ?? null
    const allOptions = item?.modifierGroups.flatMap((g) => g.options) ?? []
    const options = line.optionIds
      .map((id) => allOptions.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => !!o)
    const groupsOk =
      !!item &&
      item.modifierGroups.every((g) => {
        const picked = g.options.filter((o) => line.optionIds.includes(o.id)).length
        return picked >= g.minSelect && picked <= g.maxSelect
      })
    const unavailable =
      !item ||
      !item.isAvailable ||
      options.length !== line.optionIds.length ||
      options.some((o) => !o.isAvailable) ||
      !groupsOk
    const quantity = Math.min(Math.max(line.quantity, 1), 20)
    const { modifiersTotal, lineTotal } = item
      ? computeLine({ unitPrice: item.price, quantity, modifierPrices: options.map((o) => o.price) })
      : { modifiersTotal: 0, lineTotal: 0 }
    return { line, item, options, unitPrice: item?.price ?? 0, modifiersTotal, lineTotal, unavailable }
  })
}

export function cartSubtotal(resolved: ResolvedLine[]): number {
  return resolved.filter((r) => !r.unavailable).reduce((sum, r) => sum + r.lineTotal, 0)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}

/** Stable identity of a line's contents, used to merge identical adds. */
export function lineSignature(line: Pick<CartLine, "itemId" | "optionIds" | "note">): string {
  return `${line.itemId}|${[...line.optionIds].sort().join(",")}|${line.note.trim()}`
}

/** Hash of the whole cart, used to scope the checkout idempotency key. */
export function cartSignature(lines: CartLine[]): string {
  return lines.map((l) => `${lineSignature(l)}x${l.quantity}`).join(";")
}
