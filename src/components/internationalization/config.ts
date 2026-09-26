export const i18n = {
  defaultLocale: "en",
  locales: ["en", "rw", "ar"],
} as const;

export type Locale = (typeof i18n)["locales"][number];

type LocaleMeta = {
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  /** BCP 47 tag used for Intl formatting (dates, numbers). */
  intl: string;
  /** OpenGraph locale. */
  og: string;
};

// Typed as Record<Locale, …> so adding a locale without its metadata fails
// typecheck instead of silently falling back.
export const localeConfig: Record<Locale, LocaleMeta> = {
  en: { name: "English", nativeName: "English", dir: "ltr", intl: "en-RW", og: "en_RW" },
  rw: { name: "Kinyarwanda", nativeName: "Ikinyarwanda", dir: "ltr", intl: "rw-RW", og: "rw_RW" },
  ar: { name: "Arabic", nativeName: "العربية", dir: "rtl", intl: "ar", og: "ar_AR" },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (i18n.locales as readonly string[]).includes(value);
}

export function toLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : i18n.defaultLocale;
}

export function isRTL(locale: Locale): boolean {
  return localeConfig[locale].dir === "rtl";
}

/** Matches a leading locale segment: /en, /rw/…, /ar?… */
export const LOCALE_SEGMENT = new RegExp(`^/(${i18n.locales.join("|")})(?=/|$)`);

/** Swap (or add) the locale segment of a path: /en/order → /ar/order. */
export function switchLocalePath(pathname: string, target: Locale): string {
  return LOCALE_SEGMENT.test(pathname) ? pathname.replace(LOCALE_SEGMENT, `/${target}`) : `/${target}${pathname}`
}
