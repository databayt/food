/**
 * Seed the Charles Burgers menu — idempotent and create-only.
 *
 *   pnpm seed:menu
 *
 * Every price below is verified against the owner's printed-menu photographs
 * (see docs/menu-sources.md). Rows are created if missing and NEVER
 * overwritten, so re-running the seed cannot clobber edits staff made in the
 * admin. Kinyarwanda and Arabic names ship with the seed (rw pending the
 * owner's copy review); a missing translation row is added, an existing one
 * — in any locale — is never touched.
 */
import "dotenv/config"

import { db } from "../src/lib/db"
import { ITEM_PHOTOS, MENU_ORDER } from "./process-item-photos"

type Text = { name: string; description?: string }
/** Non-default locales. English lives in the row itself. */
type Localized = { rw: Text; ar: Text }

type Seed = {
  slug: string
  category: string
  name: string
  description?: string
  price: number
  isNew?: boolean
  modifiers?: string[]
} & Localized

const CATEGORIES: ({ slug: string; name: string } & Localized)[] = [
  { slug: "burgers", name: "Burgers", rw: { name: "Burger" }, ar: { name: "برغر" } },
  { slug: "combos", name: "Combos", rw: { name: "Combo" }, ar: { name: "كومبو" } },
  { slug: "meals", name: "Meals", rw: { name: "Amafunguro" }, ar: { name: "وجبات" } },
  { slug: "extras", name: "Extras", rw: { name: "Inyongera" }, ar: { name: "إضافات" } },
  { slug: "drinks", name: "Drinks", rw: { name: "Ibinyobwa" }, ar: { name: "مشروبات" } },
]

// Source: IMG_2910 (burger menu) and IMG_2911 (meals menu).
const ITEMS: Seed[] = [
  { slug: "classic-beef-burger", category: "burgers", name: "Classic Beef Burger", description: "Single beef patty.", price: 3000, modifiers: ["extras", "add-drinks"],
    rw: { name: "Burger y'inka isanzwe", description: "Inyama imwe y'inka." },
    ar: { name: "برغر لحم كلاسيك", description: "قطعة لحم واحدة." },
  },
  { slug: "double-beef-burger", category: "burgers", name: "Double Beef Burger", description: "Two beef patties.", price: 4000, modifiers: ["extras", "add-drinks"],
    rw: { name: "Burger y'inka ikubye kabiri", description: "Inyama ebyiri z'inka." },
    ar: { name: "برغر لحم دبل", description: "قطعتا لحم." },
  },
  { slug: "classic-chicken-burger", category: "burgers", name: "Classic Chicken Burger", description: "Single chicken fillet.", price: 3500, modifiers: ["extras", "add-drinks"],
    rw: { name: "Burger y'inkoko isanzwe", description: "Agace kamwe k'inkoko." },
    ar: { name: "برغر دجاج كلاسيك", description: "قطعة فيليه دجاج واحدة." },
  },
  { slug: "double-chicken-burger", category: "burgers", name: "Double Chicken Burger", description: "Two chicken fillets.", price: 4500, modifiers: ["extras", "add-drinks"],
    rw: { name: "Burger y'inkoko ikubye kabiri", description: "Uduce tubiri tw'inkoko." },
    ar: { name: "برغر دجاج دبل", description: "قطعتا فيليه دجاج." },
  },
  { slug: "special-charles-burger", category: "burgers", name: "Special Charles Burger", description: "Double beef, cheese & sauce.", price: 5500, isNew: true, modifiers: ["extras", "add-drinks"],
    rw: { name: "Burger idasanzwe ya Charles", description: "Inyama ebyiri z'inka, foromaje n'isosi." },
    ar: { name: "برغر تشارلز الخاص", description: "لحم دبل مع جبن وصوص." },
  },
  { slug: "classic-beef-burger-fries", category: "combos", name: "Classic Beef Burger + Fries", description: "Classic Beef Burger with fries.", price: 5000, modifiers: ["extras", "add-drinks"],
    rw: { name: "Burger y'inka isanzwe + ifiriti", description: "Burger y'inka isanzwe n'ifiriti." },
    ar: { name: "برغر لحم كلاسيك + بطاطس", description: "برغر لحم كلاسيك مع بطاطس مقلية." },
  },
  { slug: "double-beef-burger-fries", category: "combos", name: "Double Beef Burger + Fries", description: "Double Beef Burger with fries.", price: 5500, modifiers: ["extras", "add-drinks"],
    rw: { name: "Burger y'inka ikubye kabiri + ifiriti", description: "Burger y'inka ikubye kabiri n'ifiriti." },
    ar: { name: "برغر لحم دبل + بطاطس", description: "برغر لحم دبل مع بطاطس مقلية." },
  },
  { slug: "classic-chicken-burger-fries", category: "combos", name: "Classic Chicken Burger + Fries", description: "Classic Chicken Burger with fries.", price: 5000, modifiers: ["extras", "add-drinks"],
    rw: { name: "Burger y'inkoko isanzwe + ifiriti", description: "Burger y'inkoko isanzwe n'ifiriti." },
    ar: { name: "برغر دجاج كلاسيك + بطاطس", description: "برغر دجاج كلاسيك مع بطاطس مقلية." },
  },
  { slug: "double-chicken-burger-fries", category: "combos", name: "Double Chicken Burger + Fries", description: "Double Chicken Burger with fries.", price: 6000, modifiers: ["extras", "add-drinks"],
    rw: { name: "Burger y'inkoko ikubye kabiri + ifiriti", description: "Burger y'inkoko ikubye kabiri n'ifiriti." },
    ar: { name: "برغر دجاج دبل + بطاطس", description: "برغر دجاج دبل مع بطاطس مقلية." },
  },
  { slug: "beef-pilau", category: "meals", name: "Beef Pilau", price: 4000, modifiers: ["add-drinks"],
    rw: { name: "Pilawo y'inka" },
    ar: { name: "بيلاو باللحم" },
  },
  { slug: "chicken-and-fries", category: "meals", name: "Chicken & Fries", price: 5000, modifiers: ["add-drinks"],
    rw: { name: "Inkoko n'ifiriti" },
    ar: { name: "دجاج مع بطاطس" },
  },
  { slug: "chicken-pilau", category: "meals", name: "Chicken Pilau", price: 5000, modifiers: ["add-drinks"],
    rw: { name: "Pilawo y'inkoko" },
    ar: { name: "بيلاو بالدجاج" },
  },
  { slug: "cheese-extra", category: "extras", name: "Cheese Extra", price: 500,
    rw: { name: "Foromaje y'inyongera" },
    ar: { name: "جبن إضافي" },
  },
  { slug: "sauce-extra", category: "extras", name: "Sauce Extra", price: 500,
    rw: { name: "Isosi y'inyongera" },
    ar: { name: "صوص إضافي" },
  },
  { slug: "fries-extra", category: "extras", name: "Fries Extra", price: 2000,
    rw: { name: "Ifiriti y'inyongera" },
    ar: { name: "بطاطس إضافية" },
  },
  { slug: "soft-drink", category: "drinks", name: "Fanta / Cola / Sprite", description: "Choose your drink.", price: 1200, modifiers: ["drink-choice"],
    rw: { name: "Fanta / Cola / Sprite", description: "Hitamo icyo kunywa." },
    ar: { name: "فانتا / كولا / سبرايت", description: "اختر مشروبك." },
  },
]

// The menu's own Extras, offered as add-ons, plus the printed drink choice.
const MODIFIER_GROUPS = [
  {
    slug: "extras",
    name: "Extras",
    rw: { name: "Inyongera" },
    ar: { name: "الإضافات" },
    minSelect: 0,
    maxSelect: 3,
    options: [
      { slug: "extras-cheese", name: "Cheese", price: 500, rw: { name: "Foromaje" }, ar: { name: "جبن" } },
      { slug: "extras-sauce", name: "Sauce", price: 500, rw: { name: "Isosi" }, ar: { name: "صوص" } },
      { slug: "extras-fries", name: "Fries", price: 2000, rw: { name: "Ifiriti" }, ar: { name: "بطاطس" } },
    ],
  },
  {
    slug: "drink-choice",
    name: "Drink",
    rw: { name: "Icyo kunywa" },
    ar: { name: "المشروب" },
    minSelect: 1,
    maxSelect: 1,
    options: [
      { slug: "drink-fanta", name: "Fanta", price: 0, rw: { name: "Fanta" }, ar: { name: "فانتا" } },
      { slug: "drink-cola", name: "Cola", price: 0, rw: { name: "Cola" }, ar: { name: "كولا" } },
      { slug: "drink-sprite", name: "Sprite", price: 0, rw: { name: "Sprite" }, ar: { name: "سبرايت" } },
    ],
  },
  // Add a drink to a burger, combo or meal — shown as badges below Extras.
  // Priced at the menu's drink price (1,200 RWF each, IMG_2910).
  {
    slug: "add-drinks",
    name: "Drinks",
    rw: { name: "Ibinyobwa" },
    ar: { name: "مشروبات" },
    minSelect: 0,
    maxSelect: 3,
    options: [
      { slug: "add-drink-fanta", name: "Fanta", price: 1200, rw: { name: "Fanta" }, ar: { name: "فانتا" } },
      { slug: "add-drink-cola", name: "Cola", price: 1200, rw: { name: "Cola" }, ar: { name: "كولا" } },
      { slug: "add-drink-sprite", name: "Sprite", price: 1200, rw: { name: "Sprite" }, ar: { name: "سبرايت" } },
    ],
  },
]

const LOCALES = ["rw", "ar"] as const

/**
 * Create-only per (row, locale): fills a missing rw/ar row on a database
 * seeded before the translations existed, and leaves any row staff already
 * wrote untouched.
 */
async function addMissingTranslations(
  existing: { locale: string }[],
  texts: Localized,
  create: (locale: (typeof LOCALES)[number], text: Text) => Promise<unknown>
) {
  for (const locale of LOCALES) {
    if (!existing.some((t) => t.locale === locale)) await create(locale, texts[locale])
  }
}

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
      include: { translations: { select: { locale: true } } },
    })
    await addMissingTranslations(row.translations, c, (locale, t) =>
      db.menuCategoryTranslation.create({ data: { categoryId: row.id, locale, name: t.name } })
    )
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
      include: { translations: { select: { locale: true } } },
    })
    await addMissingTranslations(row.translations, g, (locale, t) =>
      db.modifierGroupTranslation.create({ data: { groupId: row.id, locale, name: t.name } })
    )
    groupIds.set(g.slug, row.id)
    for (const [i, o] of g.options.entries()) {
      const option = await db.modifierOption.upsert({
        where: { slug: o.slug },
        update: {},
        create: {
          slug: o.slug,
          groupId: row.id,
          price: o.price,
          sortOrder: i * 10,
          translations: { create: { locale: "en", name: o.name } },
        },
        include: { translations: { select: { locale: true } } },
      })
      await addMissingTranslations(option.translations, o, (locale, t) =>
        db.modifierOptionTranslation.create({ data: { optionId: option.id, locale, name: t.name } })
      )
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
        sortOrder: ((MENU_ORDER as readonly string[]).indexOf(item.slug) + 1 || index + 20) * 10,
        source: "PHOTO",
        translations: {
          create: { locale: "en", name: item.name, description: item.description ?? null },
        },
      },
      include: { translations: { select: { locale: true } } },
    })
    await addMissingTranslations(row.translations, item, (locale, t) =>
      db.menuItemTranslation.create({
        data: { itemId: row.id, locale, name: t.name, description: t.description ?? null },
      })
    )
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
