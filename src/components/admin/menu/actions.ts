"use server"

import { Prisma } from "@prisma/client"

import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { db } from "@/lib/db"

import { adminGuard, revalidateAll } from "../guard"
import { firstError, splitTranslations } from "../validation"
import { ItemSchema } from "./validation"

const IdSchema = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 40 ? v : null)

async function writeItem(id: string | null, input: unknown): Promise<ActionResponse<{ id: string }>> {
  const guard = await adminGuard()
  if ("error" in guard) return fail(guard.error)

  const parsed = ItemSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION", firstError(parsed.error))
  const d = parsed.data
  const { upserts, deletes } = splitTranslations(d.translations)

  try {
    const item = await db.$transaction(async (tx) => {
      const base = {
        slug: d.slug,
        categoryId: d.categoryId,
        price: d.price,
        imageUrl: d.imageUrl || null,
        sortOrder: d.sortOrder,
        isAvailable: d.isAvailable,
        isNew: d.isNew,
      }
      const row = id
        ? await tx.menuItem.update({ where: { id }, data: { ...base, source: "STAFF" } })
        : await tx.menuItem.create({ data: { ...base, source: "STAFF" } })

      await tx.menuItemTranslation.deleteMany({ where: { itemId: row.id, locale: { in: deletes } } })
      for (const t of upserts) {
        await tx.menuItemTranslation.upsert({
          where: { itemId_locale: { itemId: row.id, locale: t.locale } },
          update: { name: t.name, description: t.description },
          create: { itemId: row.id, locale: t.locale, name: t.name, description: t.description },
        })
      }
      await tx.menuItemModifierGroup.deleteMany({ where: { itemId: row.id } })
      if (d.groupIds.length > 0) {
        await tx.menuItemModifierGroup.createMany({
          data: [...new Set(d.groupIds)].map((groupId, i) => ({ itemId: row.id, groupId, sortOrder: i })),
        })
      }
      return row
    })
    revalidateAll()
    return ok({ id: item.id })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return fail("SLUG_TAKEN", { errors: { slug: "SLUG_TAKEN" } })
      if (error.code === "P2025") return fail("NOT_FOUND")
      if (error.code === "P2003") return fail("VALIDATION")
    }
    console.error("[writeItem] failed", error)
    return fail("GENERIC")
  }
}

/**
 * Editing an item never touches past orders — they carry their own name and
 * price snapshots. Price changes apply to new orders only.
 */
export async function createItem(input: unknown) {
  return writeItem(null, input)
}

export async function updateItem(id: string, input: unknown) {
  const itemId = IdSchema(id)
  if (!itemId) return fail("NOT_FOUND")
  return writeItem(itemId, input)
}

/** Day-to-day "sold out" switch — no deletion. */
export async function setItemAvailability(id: string, isAvailable: boolean): Promise<ActionResponse<null>> {
  const guard = await adminGuard()
  if ("error" in guard) return fail(guard.error)
  const itemId = IdSchema(id)
  if (!itemId) return fail("NOT_FOUND")
  const res = await db.menuItem.updateMany({ where: { id: itemId }, data: { isAvailable: isAvailable === true } })
  if (res.count === 0) return fail("NOT_FOUND")
  revalidateAll()
  return ok(null)
}

/** Archive hides an item from the menu while keeping it for order history. */
export async function setItemArchived(id: string, isArchived: boolean): Promise<ActionResponse<null>> {
  const guard = await adminGuard()
  if ("error" in guard) return fail(guard.error)
  const itemId = IdSchema(id)
  if (!itemId) return fail("NOT_FOUND")
  const res = await db.menuItem.updateMany({ where: { id: itemId }, data: { isArchived: isArchived === true } })
  if (res.count === 0) return fail("NOT_FOUND")
  revalidateAll()
  return ok(null)
}
