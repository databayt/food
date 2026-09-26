import "server-only"

import { i18n, type Locale } from "@/components/internationalization/config"
import { db } from "@/lib/db"
import { pickTranslation } from "@/lib/order/localize"

export type AdminItemRow = {
  id: string
  slug: string
  name: string
  categoryName: string
  price: number
  isAvailable: boolean
  isArchived: boolean
  isNew: boolean
  source: "PHOTO" | "STAFF"
  missingLocales: Locale[]
}

/** Every menu item grouped by category order, archived included (filtered in UI). */
export async function getAdminItems(locale: Locale): Promise<AdminItemRow[]> {
  const items = await db.menuItem.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: { translations: true, category: { include: { translations: true } } },
  })
  return items.map((i) => ({
    id: i.id,
    slug: i.slug,
    name: pickTranslation(i.translations, locale)?.name ?? i.slug,
    categoryName: pickTranslation(i.category.translations, locale)?.name ?? i.category.slug,
    price: i.price,
    isAvailable: i.isAvailable,
    isArchived: i.isArchived,
    isNew: i.isNew,
    source: i.source,
    missingLocales: i18n.locales.filter((l) => !i.translations.some((t) => t.locale === l && t.name)),
  }))
}

export type EditorOptions = {
  categories: { id: string; name: string }[]
  groups: { id: string; name: string }[]
}

export async function getEditorOptions(locale: Locale): Promise<EditorOptions> {
  const [categories, groups] = await Promise.all([
    db.menuCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { translations: true } }),
    db.modifierGroup.findMany({ orderBy: { sortOrder: "asc" }, include: { translations: true } }),
  ])
  return {
    categories: categories.map((c) => ({ id: c.id, name: pickTranslation(c.translations, locale)?.name ?? c.slug })),
    groups: groups.map((g) => ({ id: g.id, name: pickTranslation(g.translations, locale)?.name ?? g.slug })),
  }
}

export async function getAdminItem(id: string) {
  return db.menuItem.findUnique({
    where: { id },
    include: { translations: true, modifierGroups: { orderBy: { sortOrder: "asc" } } },
  })
}
