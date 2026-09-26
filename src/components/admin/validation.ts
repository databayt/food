import * as z from "zod"

import { i18n, type Locale } from "@/components/internationalization/config"

/** Whole, non-negative francs. Inputs arrive as strings from the form. */
export const francs = z.coerce
  .number({ error: "PRICE_INVALID" })
  .int("PRICE_INVALID")
  .min(0, "PRICE_INVALID")
  .max(10_000_000, "PRICE_INVALID")

export const sortOrder = z.coerce.number().int().min(0).max(100_000).default(0)

export const slug = z
  .string()
  .trim()
  .min(2, "SLUG_INVALID")
  .max(60, "SLUG_INVALID")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "SLUG_INVALID")

const nameOnly = z.object({ name: z.string().trim().max(80, "TOO_LONG").default("") })
const nameAndDescription = nameOnly.extend({ description: z.string().trim().max(300, "TOO_LONG").default("") })

const requireEnglish = (value: { en: { name: string } }, ctx: z.RefinementCtx) => {
  if (!value.en.name) ctx.addIssue({ code: "custom", path: ["en", "name"], message: "NAME_REQUIRED" })
}

// `satisfies Record<Locale, …>` makes adding a locale without a field a type error.
const namesShape = { en: nameOnly, rw: nameOnly, ar: nameOnly } satisfies Record<Locale, typeof nameOnly>
const namesWithDescriptionShape = {
  en: nameAndDescription,
  rw: nameAndDescription,
  ar: nameAndDescription,
} satisfies Record<Locale, typeof nameAndDescription>

const namesSchema = z.object(namesShape).superRefine(requireEnglish)
const namesWithDescriptionSchema = z.object(namesWithDescriptionShape).superRefine(requireEnglish)

/**
 * Per-locale names (+ optional descriptions). English is required — it is the
 * fallback every other locale uses when its own text is empty.
 */
export function translationsSchema(): typeof namesSchema
export function translationsSchema(withDescription: true): typeof namesWithDescriptionSchema
export function translationsSchema(withDescription = false) {
  return withDescription ? namesWithDescriptionSchema : namesSchema
}

export type TranslationValues = Record<Locale, { name: string; description?: string }>

/** Rows to upsert and locales to delete (empty text → fall back to English). */
export function splitTranslations(values: TranslationValues) {
  const upserts: { locale: Locale; name: string; description: string | null }[] = []
  const deletes: Locale[] = []
  for (const locale of i18n.locales) {
    const v = values[locale]
    if (v?.name) upserts.push({ locale, name: v.name, description: v.description ? v.description : null })
    else deletes.push(locale)
  }
  return { upserts, deletes }
}

export function firstError(error: z.ZodError): { error: string; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_"
    if (!errors[key]) errors[key] = /^[A-Z_]+$/.test(issue.message) ? issue.message : "VALIDATION"
  }
  return { error: Object.values(errors)[0] ?? "VALIDATION", errors }
}
