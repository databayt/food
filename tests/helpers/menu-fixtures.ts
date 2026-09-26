/** In-memory menu rows shaped like resolveOrderLines' Prisma include. */
type Opt = { id: string; price: number; isAvailable?: boolean; name: string }

export function option({ id, price, isAvailable = true, name }: Opt) {
  return { id, price, isAvailable, translations: [{ locale: "en", name }] }
}

export function group(id: string, name: string, minSelect: number, maxSelect: number, options: ReturnType<typeof option>[]) {
  return { group: { id, minSelect, maxSelect, translations: [{ locale: "en", name }], options } }
}

export function menuItem(
  id: string,
  name: string,
  price: number,
  opts: { isAvailable?: boolean; isArchived?: boolean; categoryActive?: boolean; groups?: ReturnType<typeof group>[] } = {}
) {
  return {
    id,
    price,
    isAvailable: opts.isAvailable ?? true,
    isArchived: opts.isArchived ?? false,
    category: { isActive: opts.categoryActive ?? true },
    translations: [
      { locale: "en", name },
      { locale: "ar", name: `${name} (ar)` },
    ],
    modifierGroups: opts.groups ?? [],
  }
}

export const EXTRAS = group("g-extras", "Extras", 0, 2, [
  option({ id: "o-cheese", price: 500, name: "Cheese" }),
  option({ id: "o-sauce", price: 500, name: "Sauce" }),
  option({ id: "o-fries", price: 2000, name: "Fries", isAvailable: false }),
])

export const DRINK = group("g-drink", "Drink", 1, 1, [
  option({ id: "o-fanta", price: 0, name: "Fanta" }),
  option({ id: "o-cola", price: 0, name: "Cola" }),
])

export const MENU = [
  menuItem("i-classic", "Classic Beef Burger", 3000, { groups: [EXTRAS] }),
  menuItem("i-drink", "Fanta / Cola / Sprite", 1200, { groups: [DRINK] }),
  menuItem("i-soldout", "Chicken Pilau", 5000, { isAvailable: false }),
  menuItem("i-archived", "Old Item", 1000, { isArchived: true }),
]

export const SETTINGS = {
  id: "default",
  isOpen: true,
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryFee: 1000,
  cashEnabled: true,
  momoEnabled: true,
}
