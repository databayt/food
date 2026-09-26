import "server-only";
import { i18n, type Locale } from "./config";

const dictionaries = {
  en: () => import("./en.json").then((module) => module.default),
  rw: () => import("./rw.json").then((module) => module.default),
  ar: () => import("./ar.json").then((module) => module.default),
} as const;

export const getDictionary = async (locale: Locale) => {
  try {
    return await (dictionaries[locale] ?? dictionaries[i18n.defaultLocale])();
  } catch {
    console.warn(`Failed to load dictionary for locale: ${locale}. Falling back to ${i18n.defaultLocale}.`);
    return await dictionaries[i18n.defaultLocale]();
  }
};

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
