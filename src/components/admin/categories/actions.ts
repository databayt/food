"use server"

import { Prisma } from "@prisma/client"

import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { db } from "@/lib/db"

import { adminGuard, revalidateAll } from "../guard"
import { firstError, splitTranslations } from "../validation"
import { CategorySchema } from "./validation"

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResponse<{ id: string }>> {
  const guard = await adminGuard()
  if ("error" in guard) return fail(guard.error)
  const parsed = CategorySchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION", firstError(parsed.error))
  const d = parsed.data
  const { upserts, deletes } = splitTranslations(d.translations)

  try {
    const row = await db.$transaction(async (tx) => {
      const base = { slug: d.slug, sortOrder: d.sortOrder, isActive: d.isActive }
      const cat = id ? await tx.menuCategory.update({ where: { id }, data: base }) : await tx.menuCategory.create({ data: base })
      await tx.menuCategoryTranslation.deleteMany({ where: { categoryId: cat.id, locale: { in: deletes } } })
      for (const t of upserts) {
        await tx.menuCategoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: cat.id, locale: t.locale } },
          update: { name: t.name },
          create: { categoryId: cat.id, locale: t.locale, name: t.name },
        })
      }
      return cat
    })
    revalidateAll()
    return ok({ id: row.id })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("SLUG_TAKEN", { errors: { slug: "SLUG_TAKEN" } })
    }
    console.error("[saveCategory] failed", error)
    return fail("GENERIC")
  }
}
