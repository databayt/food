/**
 * Seed the Charles Burgers menu — idempotent and create-only.
 *
 *   pnpm seed:menu
 *
 * Every price below is verified against the owner's printed-menu photographs
 * (see docs/menu-sources.md). Rows are created if missing and NEVER
 * overwritten, so re-running the seed cannot clobber edits staff made in the
 * admin. Names are seeded in English only; rw/ar fall back to English until
 * staff add translations — nothing is machine-invented.
 */
import "dotenv/config"

import { db } from "../src/lib/db"
import { ITEM_PHOTOS } from "./process-item-photos"

type Seed = {
  slug: string
  category: string
  name: string
  description?: string
  price: number
  isNew?: boolean
  modifiers?: string[]
}

const CATEGORIES = [
  { slug: "burgers", name: "Burgers" },
  { slug: "combos", name: "Combos" },
  { slug: "meals", name: "Meals" },
  { slug: "extras", name: "Extras" },
  { slug: "drinks", name: "Drinks" },
]

// Source: IMG_2910 (burger menu) and IMG_2911 (meals menu).
const ITEMS: Seed[] = [
  { slug: "classic-beef-burger", category: "burgers", name: "Classic Beef Burger", description: "Single beef patty.", price: 3000, modifiers: ["extras"] },
  { slug: "double-beef-burger", category: "burgers", name: "Double Beef Burger", description: "Two beef patties.", price: 4000, modifiers: ["extras"] },
  { slug: "classic-chicken-burger", category: "burgers", name: "Classic Chicken Burger", description: "Single chicken fillet.", price: 3500, modifiers: ["extras"] },
  { slug: "double-chicken-burger", category: "burgers", name: "Double Chicken Burger", description: "Two chicken fillets.", price: 4500, modifiers: ["extras"] },
  { slug: "special-charles-burger", category: "burgers", name: "Special Charles Burger", description: "Double beef, cheese & sauce.", price: 5500, isNew: true, modifiers: ["extras"] },
  { slug: "classic-beef-burger-fries", category: "combos", name: "Classic Beef Burger + Fries", description: "Classic Beef Burger with fries.", price: 5000, modifiers: ["extras"] },
  { slug: "double-beef-burger-fries", category: "combos", name: "Double Beef Burger + Fries", description: "Double Beef Burger with fries.", price: 5500, modifiers: ["extras"] },
  { slug: "classic-chicken-burger-fries", category: "combos", name: "Classic Chicken Burger + Fries", description: "Classic Chicken Burger with fries.", price: 5000, modifiers: ["extras"] },
  { slug: "double-chicken-burger-fries", category: "combos", name: "Double Chicken Burger + Fries", description: "Double Chicken Burger with fries.", price: 6000, modifiers: ["extras"] },
  { slug: "beef-pilau", category: "meals", name: "Beef Pilau", price: 4000 },
  { slug: "chicken-and-fries", category: "meals", name: "Chicken & Fries", price: 5000 },
  { slug: "chicken-pilau", category: "meals", name: "Chicken Pilau", price: 5000 },
  { slug: "cheese-extra", category: "extras", name: "Cheese Extra", price: 500 },
  { slug: "sauce-extra", category: "extras", name: "Sauce Extra", price: 500 },
  { slug: "fries-extra", category: "extras", name: "Fries Extra", price: 2000 },
  { slug: "soft-drink", category: "drinks", name: "Fanta / Cola / Sprite", description: "Choose your drink.", price: 1200, modifiers: ["drink-choice"] },
]

// The menu's own Extras, offered as add-ons, plus the printed drink choice.
const MODIFIER_GROUPS = [
  {
    slug: "extras",
    name: "Extras",
    minSelect: 0,
    maxSelect: 3,
    options: [
      { slug: "extras-cheese", name: "Cheese", price: 500 },
      { slug: "extras-sauce", name: "Sauce", price: 500 },
      { slug: "extras-fries", name: "Fries", price: 2000 },
    ],
  },
  {
    slug: "drink-choice",
    name: "Drink",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { slug: "drink-fanta", name: "Fanta", price: 0 },
      { slug: "drink-cola", name: "Cola", price: 0 },
      { slug: "drink-sprite", name: "Sprite", price: 0 },
    ],
  },
]

async function main() {
  await db.restaurant.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Charles Burgers",
      legalName: "Charles Burger Resto LTD",
      phone: "+250794000095",
      // Printed phone number — confirm with the owner that it is on WhatsApp.
      whatsappNumber: "+250794000095",
      momoCode: "110009",
      tiktok: "@charles_burger",
      address: "Kigali, Rwanda",
      pickupEnabled: true,
      deliveryEnabled: true,
      // Not printed on the menu — the owner sets it in Admin → Settings.
      deliveryFee: 0,
    },
  })

  const categoryIds = new Map<string, string>()
  for (const [index, c] of CATEGORIES.entries()) {
    const row = await db.menuCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, sortOrder: index * 10, translations: { create: { locale: "en", name: c.name } } },
    })
    categoryIds.set(c.slug, row.id)
  }

  const groupIds = new Map<string, string>()
  for (const [index, g] of MODIFIER_GROUPS.entries()) {
    const row = await db.modifierGroup.upsert({
      where: { slug: g.slug },
      update: {},
      create: {
        slug: g.slug,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        sortOrder: index * 10,
        translations: { create: { locale: "en", name: g.name } },
      },
    })
    groupIds.set(g.slug, row.id)
    for (const [i, o] of g.options.entries()) {
      await db.modifierOption.upsert({
        where: { slug: o.slug },
        update: {},
        create: {
          slug: o.slug,
          groupId: row.id,
          price: o.price,
          sortOrder: i * 10,
          translations: { create: { locale: "en", name: o.name } },
        },
      })
    }
  }

  for (const [index, item] of ITEMS.entries()) {
    const categoryId = categoryIds.get(item.category)
    if (!categoryId) throw new Error(`Unknown category ${item.category}`)
    const row = await db.menuItem.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        slug: item.slug,
        categoryId,
        price: item.price,
        imageUrl: item.slug in ITEM_PHOTOS ? `/items/${item.slug}.webp` : null,
        isNew: item.isNew ?? false,
        sortOrder: index * 10,
        source: "PHOTO",
        translations: {
          create: { locale: "en", name: item.name, description: item.description ?? null },
        },
      },
    })
    for (const [i, groupSlug] of (item.modifiers ?? []).entries()) {
      const groupId = groupIds.get(groupSlug)!
      await db.menuItemModifierGroup.upsert({
        where: { itemId_groupId: { itemId: row.id, groupId } },
        update: {},
        create: { itemId: row.id, groupId, sortOrder: i },
      })
    }
  }

  const [categories, items, options] = await Promise.all([
    db.menuCategory.count(),
    db.menuItem.count(),
    db.modifierOption.count(),
  ])
  console.log(`✓ menu seeded — ${categories} categories, ${items} items, ${options} modifier options`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
