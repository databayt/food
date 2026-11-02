import { i18n, type Locale } from "@/components/internationalization/config"

/**
 * Plain data helpers for the per-locale name/description fields. Kept out of
 * the "use client" TranslationFields module on purpose: server pages call
 * these, and a function exported from a client module is only a client
 * reference on the server — calling it throws (React error #441 in prod).
 */
export type TranslationDraft = Record<Locale, { name: string; description: string }>

export function emptyDraft(): TranslationDraft {
  return Object.fromEntries(i18n.locales.map((l) => [l, { name: "", description: "" }])) as TranslationDraft
}

export function draftFrom(rows: { locale: string; name: string; description?: string | null }[]): TranslationDraft {
  const draft = emptyDraft()
  for (const r of rows) {
    if (r.locale in draft) draft[r.locale as Locale] = { name: r.name, description: r.description ?? "" }
  }
  return draft
}
