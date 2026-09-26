import * as z from "zod"

import { slug, sortOrder, translationsSchema } from "../validation"

export const CategorySchema = z.object({
  slug,
  sortOrder,
  isActive: z.boolean(),
  translations: translationsSchema(),
})
