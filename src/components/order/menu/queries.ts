import "server-only"

import { unstable_cache } from "next/cache"
import { connection } from "next/server"

import type { Locale } from "@/components/internationalization/config"
import { MENU_TAG } from "@/lib/cache-tags"
import { db } from "@/lib/db"
import { pickTranslation } from "@/lib/order/localize"

import { OPTION_IMAGES } from "./option-images"
import type { MenuItemView, MenuView } from "./types"

/**
 * The customer menu, localized. The page still renders per request
 * (`connection()`), but the menu itself is cached per locale: the nested
 * read is nine sequential queries, each a round trip from the Workers edge
 * to the database. Admin edits — availability included — expire the tag
 * immediately; 5 minutes is only the fallback for writes outside the admin
 * (seed scripts). Checkout and the POS still price from the database.
 * Archived items and inactive categories are excluded; sold-out items stay
 * visible with a Sold out state.
 */
export async function getMenu(locale: Locale): Promise<MenuView> {
  await connection()
  return loadMenu(locale)
}

const loadMenu = unstable_cache(readMenu, ["menu"], { tags: [MENU_TAG], revalidate: 300 })

async function readMenu(locale: Locale): Promise<MenuView> {
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
              category: c.slug,
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
                  slug: o.slug,
                  name: pickTranslation(o.translations, locale)?.name ?? o.slug,
                  imageUrl: OPTION_IMAGES[o.slug] ?? null,
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
