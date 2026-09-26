"use server"

import { Prisma } from "@prisma/client"

import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { db } from "@/lib/db"

import { adminGuard, revalidateAll } from "../guard"
import { firstError, splitTranslations } from "../validation"
import { GroupSchema, OptionSchema } from "./validation"

function handle(error: unknown, label: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return fail("SLUG_TAKEN", { errors: { slug: "SLUG_TAKEN" } })
  }
  console.error(`[${label}] failed`, error)
  return fail("GENERIC")
}

export async function saveGroup(id: string | null, input: unknown): Promise<ActionResponse<{ id: string }>> {
  const guard = await adminGuard()
  if ("error" in guard) return fail(guard.error)
  const parsed = GroupSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION", firstError(parsed.error))
  const d = parsed.data
  const { upserts, deletes } = splitTranslations(d.translations)
  try {
    const row = await db.$transaction(async (tx) => {
      const base = { slug: d.slug, sortOrder: d.sortOrder, minSelect: d.minSelect, maxSelect: d.maxSelect }
      const g = id ? await tx.modifierGroup.update({ where: { id }, data: base }) : await tx.modifierGroup.create({ data: base })
      await tx.modifierGroupTranslation.deleteMany({ where: { groupId: g.id, locale: { in: deletes } } })
      for (const t of upserts) {
        await tx.modifierGroupTranslation.upsert({
          where: { groupId_locale: { groupId: g.id, locale: t.locale } },
          update: { name: t.name },
          create: { groupId: g.id, locale: t.locale, name: t.name },
        })
      }
      return g
    })
    revalidateAll()
    return ok({ id: row.id })
  } catch (error) {
    return handle(error, "saveGroup")
  }
}

export async function saveOption(groupId: string, id: string | null, input: unknown): Promise<ActionResponse<{ id: string }>> {
  const guard = await adminGuard()
  if ("error" in guard) return fail(guard.error)
  const parsed = OptionSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION", firstError(parsed.error))
  const d = parsed.data
  const { upserts, deletes } = splitTranslations(d.translations)
  try {
    const row = await db.$transaction(async (tx) => {
      const base = { slug: d.slug, sortOrder: d.sortOrder, price: d.price, isAvailable: d.isAvailable }
      const o = id
        ? await tx.modifierOption.update({ where: { id }, data: base })
        : await tx.modifierOption.create({ data: { ...base, groupId } })
      await tx.modifierOptionTranslation.deleteMany({ where: { optionId: o.id, locale: { in: deletes } } })
      for (const t of upserts) {
        await tx.modifierOptionTranslation.upsert({
          where: { optionId_locale: { optionId: o.id, locale: t.locale } },
          update: { name: t.name },
          create: { optionId: o.id, locale: t.locale, name: t.name },
        })
      }
      return o
    })
    revalidateAll()
    return ok({ id: row.id })
  } catch (error) {
    return handle(error, "saveOption")
  }
}
