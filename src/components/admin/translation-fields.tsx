"use client"

import { i18n, localeConfig, type Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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

/** Name (+ description) per locale — en, rw, ar side by side, each in its own direction. */
export function TranslationFields({
  value,
  onChange,
  withDescription = false,
  idPrefix,
}: {
  value: TranslationDraft
  onChange: (next: TranslationDraft) => void
  withDescription?: boolean
  idPrefix: string
}) {
  const dict = useDictionary()
  const set = (locale: Locale, patch: Partial<TranslationDraft[Locale]>) => onChange({ ...value, [locale]: { ...value[locale], ...patch } })

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {i18n.locales.map((locale) => (
        <div key={locale} className="space-y-2 rounded-xl border p-3" lang={locale} dir={localeConfig[locale].dir}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {localeConfig[locale].nativeName}
            {locale === i18n.defaultLocale && <span className="text-destructive"> *</span>}
          </p>
          <Label htmlFor={`${idPrefix}-${locale}-name`} className="sr-only">
            {dict?.admin?.menu?.name ?? "Name"}
          </Label>
          <Input
            id={`${idPrefix}-${locale}-name`}
            value={value[locale].name}
            maxLength={80}
            onChange={(e) => set(locale, { name: e.target.value })}
            placeholder={dict?.admin?.menu?.name ?? "Name"}
          />
          {withDescription && (
            <Textarea
              value={value[locale].description}
              maxLength={300}
              rows={2}
              onChange={(e) => set(locale, { description: e.target.value })}
              placeholder={dict?.admin?.menu?.description ?? "Description"}
            />
          )}
        </div>
      ))}
    </div>
  )
}
