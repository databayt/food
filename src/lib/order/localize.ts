import { i18n, type Locale } from "@/components/internationalization/config"

/**
 * Pick the translation row for `locale`, falling back to the default locale
 * (en). Menu text is authored per locale by staff; nothing is machine-translated.
 */
export function pickTranslation<T extends { locale: string }>(rows: readonly T[], locale: Locale): T | undefined {
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === i18n.defaultLocale) ?? rows[0]
}

/** { en, rw, ar } name map for immutable order snapshots. */
export function nameMap(rows: readonly { locale: string; name: string }[]): Record<Locale, string> {
  const fallback = pickTranslation(rows, i18n.defaultLocale)?.name ?? ""
  return Object.fromEntries(
    i18n.locales.map((l) => [l, rows.find((r) => r.locale === l)?.name || fallback])
  ) as Record<Locale, string>
}

/** Read a localized name from a snapshot map stored as Json. */
export function snapshotName(names: unknown, locale: Locale): string {
  if (names && typeof names === "object") {
    const map = names as Partial<Record<string, string>>
    return map[locale] || map[i18n.defaultLocale] || Object.values(map)[0] || ""
  }
  return ""
}
