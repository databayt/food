"use server"

import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"

import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { db } from "@/lib/db"

import { adminGuard } from "../guard"
import { firstError } from "../validation"
import { CreateStaffSchema, UpdateStaffSchema } from "./validation"

export async function createStaff(input: unknown): Promise<ActionResponse<null>> {
  const guard = await adminGuard()
  if ("error" in guard) return fail(guard.error)
  const parsed = CreateStaffSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION", firstError(parsed.error))
  const { password, ...rest } = parsed.data
  try {
    await db.user.create({ data: { ...rest, passwordHash: await bcrypt.hash(password, 12) } })
    return ok(null)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("EMAIL_TAKEN", { errors: { email: "EMAIL_TAKEN" } })
    }
    console.error("[createStaff] failed", error)
    return fail("GENERIC")
  }
}

/** Deactivating (not deleting) keeps the audit trail's actor names intact. */
export async function updateStaff(id: string, input: unknown): Promise<ActionResponse<null>> {
  const guard = await adminGuard()
  if ("error" in guard) return fail(guard.error)
  const parsed = UpdateStaffSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION", firstError(parsed.error))
  const d = parsed.data
  if (id === guard.session.user.id && (!d.isActive || d.role !== "ADMIN")) return fail("CANNOT_CHANGE_SELF")

  const res = await db.user.updateMany({
    where: { id },
    data: {
      name: d.name,
      role: d.role,
      isActive: d.isActive,
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}),
    },
  })
  return res.count === 1 ? ok(null) : fail("NOT_FOUND")
}
