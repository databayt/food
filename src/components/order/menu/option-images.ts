import type { Dictionary } from "@/components/internationalization/dictionaries"

/**
 * Pictures for modifier options, keyed by option slug (options have no image
 * column). The extras reuse the menu's own extra photos; drinks show their
 * name only until a single-drink photo is dropped at the path below and the
 * line is uncommented.
 */
export const OPTION_IMAGES: Record<string, string> = {
  "extras-cheese": "/items/cheese-extra.webp",
  "extras-sauce": "/items/sauce-extra.webp",
  "extras-fries": "/items/fries-extra.webp",
  // "drink-fanta": "/items/options/drink-fanta.webp",
  // "drink-cola": "/items/options/drink-cola.webp",
  // "drink-sprite": "/items/options/drink-sprite.webp",
};

/**
 * Quick instructions offered as badges, per category. The English text is
 * what lands in the order note (the kitchen reads English); `key` picks the
 * customer's localized label from `order.notes`.
 */
export type NoteKey = keyof Dictionary["order"]["notes"]

export const NOTE_PRESETS: Record<string, { key: NoteKey; en: string }[]> = {
  burgers: [
    { key: "noOnions", en: "No onions" },
    { key: "noTomato", en: "No tomato" },
    { key: "noLettuce", en: "No lettuce" },
    { key: "noSauce", en: "No sauce" },
    { key: "extraSpicy", en: "Extra spicy" },
    { key: "cutInHalf", en: "Cut in half" },
  ],
  meals: [
    { key: "extraSpicy", en: "Extra spicy" },
    { key: "notSpicy", en: "Not spicy" },
  ],
};
NOTE_PRESETS.combos = NOTE_PRESETS.burgers;
