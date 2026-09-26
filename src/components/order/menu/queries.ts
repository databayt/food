import "server-only"

import { connection } from "next/server"

import type { Locale } from "@/components/internationalization/config"
import { db } from "@/lib/db"
import { pickTranslation } from "@/lib/order/localize"

import type { MenuItemView, MenuView } from "./types"

/**
 * The customer menu, localized. Always rendered per request — availability
 * toggles must show up immediately, so this opts out of static prerendering.
 * Archived items and inactive categories are excluded; sold-out items stay
 * visible with a Sold out state.
 */
export async function getMenu(locale: Locale): Promise<MenuView> {
  await connection()
  const categories = await db.menuCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      translations: true,
      items: {
        where: { isArchived: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          translations: true,
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: {
              group: {
                include: {
                  translations: true,
                  options: { orderBy: { sortOrder: "asc" }, include: { translations: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  return {
    categories: categories
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: pickTranslation(c.translations, locale)?.name ?? c.slug,
        items: c.items.map(
          (item): MenuItemView => {
            const t = pickTranslation(item.translations, locale)
            return {
              id: item.id,
              slug: item.slug,
              name: t?.name ?? item.slug,
              description: t?.description ?? null,
              price: item.price,
              imageUrl: item.imageUrl,
              isAvailable: item.isAvailable,
              isNew: item.isNew,
              sortOrder: item.sortOrder,
              modifierGroups: item.modifierGroups.map(({ group }) => ({
                id: group.id,
                name: pickTranslation(group.translations, locale)?.name ?? group.slug,
                minSelect: group.minSelect,
                maxSelect: group.maxSelect,
                options: group.options.map((o) => ({
                  id: o.id,
                  name: pickTranslation(o.translations, locale)?.name ?? o.slug,
                  price: o.price,
                  isAvailable: o.isAvailable,
                })),
              })),
            }
          }
        ),
      }))
      .filter((c) => c.items.length > 0),
  }
}
