import * as z from "zod"

import { i18n } from "@/components/internationalization/config"
import { CartLineInputSchema } from "@/components/order/checkout/validation"
import { MAX_LINES } from "@/lib/order/pricing"
import { sanitizeInput, sanitizeMultiline } from "@/lib/sanitization"

/** Whole francs handed over at the counter. */
const Francs = z.number().int().min(0).max(10_000_000)

/**
 * A ticket rung up at the counter. Name and phone are optional for a
 * walk-in; a delivery needs both phone and address, MoMo needs the payer's
 * phone. Prices are never read from here — the server prices every line.
 */
export const PosOrderSchema = z
  .object({
    idempotencyKey: z.uuid(),
    locale: z.enum(i18n.locales),
    lines: z.array(CartLineInputSchema).min(1, "EMPTY_CART").max(MAX_LINES, "TOO_LONG"),
    fulfillment: z.enum(["PICKUP", "DELIVERY"]),
    name: z.string().max(60, "NAME_INVALID").optional().transform((v) => (v ? sanitizeInput(v) : "")),
    phone: z.string().max(20, "PHONE_INVALID").optional().transform((v) => v?.trim() ?? ""),
    address: z.string().max(200, "TOO_LONG").optional().transform((v) => (v ? sanitizeInput(v) : "")),
    note: z.string().max(280, "TOO_LONG").optional().transform((v) => (v ? sanitizeMultiline(v) : "")),
    method: z.enum(["CASH", "MOMO"]),
    tendered: Francs.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.fulfillment === "DELIVERY" && d.address.length < 5) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "ADDRESS_REQUIRED" })
    }
    if ((d.fulfillment === "DELIVERY" || d.method === "MOMO") && !d.phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "PHONE_REQUIRED" })
    }
  })

export const PosOrderRefSchema = z.object({
  orderId: z.string().min(1).max(40),
  locale: z.enum(i18n.locales),
})

export const PosTakeCashSchema = PosOrderRefSchema.extend({ tendered: Francs.optional() })
