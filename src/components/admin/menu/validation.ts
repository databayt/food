import * as z from "zod"

import { francs, slug, sortOrder, translationsSchema } from "../validation"

export const ItemSchema = z.object({
  slug,
  categoryId: z.string().min(1, "VALIDATION").max(40),
  price: francs,
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v) || /^\/[\w\-./]+$/.test(v), "URL_INVALID"),
  sortOrder,
  isAvailable: z.boolean(),
  isNew: z.boolean(),
  groupIds: z.array(z.string().min(1).max(40)).max(10),
  translations: translationsSchema(true),
})

export type ItemInput = z.input<typeof ItemSchema>
