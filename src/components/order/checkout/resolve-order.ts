import "server-only"

import type { Prisma, PrismaClient } from "@prisma/client"

import type { Locale } from "@/components/internationalization/config"
import { nameMap } from "@/lib/order/localize"
import { computeLine } from "@/lib/order/pricing"

type Client = PrismaClient | Prisma.TransactionClient

export type ResolvedModifier = {
  modifierOptionId: string
  groupNames: Record<Locale, string>
  optionNames: Record<Locale, string>
  price: number
}

export type ResolvedOrderLine = {
  menuItemId: string
  names: Record<Locale, string>
  unitPrice: number
  quantity: number
  note: string
  modifiers: ResolvedModifier[]
  modifiersTotal: number
  lineTotal: number
}

export type ResolveResult =
  | { ok: true; lines: ResolvedOrderLine[] }
  | { ok: false; error: "ITEM_UNAVAILABLE" | "INVALID_MODIFIER"; itemIds: string[] }

type LineInput = { itemId: string; optionIds: string[]; quantity: number; note: string }

/**
 * Load the CURRENT menu rows for the requested lines and turn them into
 * priced, immutable snapshots. Every price comes from the database.
 *
 * Rejects when an item is missing / archived / sold out, or when a modifier
 * option doesn't belong to one of the item's groups, is sold out, is
 * duplicated, or a group's min/max selection rule is violated.
 */
export async function resolveOrderLines(client: Client, lines: LineInput[]): Promise<ResolveResult> {
  const itemIds = [...new Set(lines.map((l) => l.itemId))]
  const items = await client.menuItem.findMany({
    where: { id: { in: itemIds } },
    include: {
      translations: true,
      category: { select: { isActive: true } },
      modifierGroups: {
        include: {
          group: { include: { translations: true, options: { include: { translations: true } } } },
        },
      },
    },
  })
  const byId = new Map(items.map((i) => [i.id, i]))

  const unavailable = itemIds.filter((id) => {
    const item = byId.get(id)
    return !item || item.isArchived || !item.isAvailable || !item.category.isActive
  })
  if (unavailable.length > 0) return { ok: false, error: "ITEM_UNAVAILABLE", itemIds: unavailable }

  const invalid: string[] = []
  const resolved: ResolvedOrderLine[] = []

  for (const line of lines) {
    const item = byId.get(line.itemId)!
    const groups = item.modifierGroups.map((mg) => mg.group)
    const optionIndex = new Map(groups.flatMap((g) => g.options.map((o) => [o.id, { option: o, group: g }] as const)))

    const duplicates = new Set(line.optionIds).size !== line.optionIds.length
    const picked = line.optionIds.map((id) => optionIndex.get(id))
    const foreignOrSoldOut = picked.some((p) => !p || !p.option.isAvailable)
    const rulesBroken = groups.some((g) => {
      const count = line.optionIds.filter((id) => optionIndex.get(id)?.group.id === g.id).length
      return count < g.minSelect || count > g.maxSelect
    })
    if (duplicates || foreignOrSoldOut || rulesBroken) {
      invalid.push(item.id)
      continue
    }

    const modifiers: ResolvedModifier[] = picked.map((p) => ({
      modifierOptionId: p!.option.id,
      groupNames: nameMap(p!.group.translations),
      optionNames: nameMap(p!.option.translations),
      price: p!.option.price,
    }))
    const { modifiersTotal, lineTotal } = computeLine({
      unitPrice: item.price,
      quantity: line.quantity,
      modifierPrices: modifiers.map((m) => m.price),
    })
    resolved.push({
      menuItemId: item.id,
      names: nameMap(item.translations),
      unitPrice: item.price,
      quantity: line.quantity,
      note: line.note,
      modifiers,
      modifiersTotal,
      lineTotal,
    })
  }

  if (invalid.length > 0) return { ok: false, error: "INVALID_MODIFIER", itemIds: [...new Set(invalid)] }
  return { ok: true, lines: resolved }
}
