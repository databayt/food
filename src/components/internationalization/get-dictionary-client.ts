import { i18n, type Locale } from "./config"
import type { Dictionary } from "./dictionaries"

// Client-side mirror of the server loader in `dictionaries.ts` (which is
// `server-only`). One JSON file per locale.
const dictionaries = {
  en: () => import("./en.json").then((module) => module.default),
  rw: () => import("./rw.json").then((module) => module.default),
  ar: () => import("./ar.json").then((module) => module.default),
}

export const getDictionaryClient = async (
  locale: Locale
): Promise<Dictionary> => {
  const load = dictionaries[locale] ?? dictionaries[i18n.defaultLocale]
  return (await load()) as Dictionary
}
