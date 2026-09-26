"use server"

import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { db } from "@/lib/db"
import { normalizeRwandaPhone } from "@/lib/order/phone"

import { adminGuard, revalidateAll } from "../guard"
import { firstError } from "../validation"
import { SettingsSchema } from "./validation"

export async function updateSettings(input: unknown): Promise<ActionResponse<null>> {
  const guard = await adminGuard()
  if ("error" in guard) return fail(guard.error)

  const parsed = SettingsSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION", firstError(parsed.error))
  const d = parsed.data

  const data = {
    name: d.name,
    logoUrl: d.logoUrl || null,
    phone: d.phone ? normalizeRwandaPhone(d.phone) : null,
    whatsappNumber: d.whatsappNumber ? normalizeRwandaPhone(d.whatsappNumber) : null,
    momoCode: d.momoCode || null,
    tiktok: d.tiktok || null,
    address: d.address || null,
    isOpen: d.isOpen,
    pickupEnabled: d.pickupEnabled,
    deliveryEnabled: d.deliveryEnabled,
    deliveryFee: d.deliveryFee,
    cashEnabled: d.cashEnabled,
    momoEnabled: d.momoEnabled,
  }
  await db.restaurant.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } })
  revalidateAll()
  return ok(null)
}
