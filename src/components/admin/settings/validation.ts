import * as z from "zod"

import { normalizeRwandaPhone } from "@/lib/order/phone"

import { francs } from "../validation"

const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || !!normalizeRwandaPhone(v), "PHONE_INVALID")

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/\S+$/.test(v) || /^\/[\w\-./]+$/.test(v), "URL_INVALID")

export const SettingsSchema = z.object({
  name: z.string().trim().min(2, "NAME_REQUIRED").max(60, "TOO_LONG"),
  logoUrl: optionalUrl,
  phone: optionalPhone,
  whatsappNumber: optionalPhone,
  momoCode: z.string().trim().max(20, "TOO_LONG").regex(/^[0-9]*$/, "VALIDATION"),
  tiktok: z.string().trim().max(40, "TOO_LONG"),
  address: z.string().trim().max(200, "TOO_LONG"),
  isOpen: z.boolean(),
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  deliveryFee: francs,
  cashEnabled: z.boolean(),
  momoEnabled: z.boolean(),
})

export type SettingsInput = z.input<typeof SettingsSchema>
