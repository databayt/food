import * as z from "zod"

import { francs, slug, sortOrder, translationsSchema } from "../validation"

export const GroupSchema = z
  .object({
    slug,
    sortOrder,
    minSelect: z.coerce.number().int().min(0).max(10),
    maxSelect: z.coerce.number().int().min(1).max(10),
    translations: translationsSchema(),
  })
  .refine((g) => g.minSelect <= g.maxSelect, { message: "MIN_MAX_INVALID", path: ["minSelect"] })

export const OptionSchema = z.object({
  slug,
  sortOrder,
  price: francs,
  isAvailable: z.boolean(),
  translations: translationsSchema(),
})
