import * as z from "zod"

import { i18n } from "@/components/internationalization/config"
import { MAX_LINES, MAX_QUANTITY } from "@/lib/order/pricing"
import { normalizeRwandaPhone } from "@/lib/order/phone"
import { sanitizeInput, sanitizeMultiline } from "@/lib/sanitization"

/**
 * Guest checkout payload. Error messages are CODES mapped by dict.errors.
 * Unknown keys (e.g. a manipulated `price` or `total`) are stripped — the
 * server never reads prices from the client.
 */
export const CartLineInputSchema = z.object({
  itemId: z.string().min(1).max(40),
  optionIds: z.array(z.string().min(1).max(40)).max(20).default([]),
  quantity: z.number().int().min(1, "QUANTITY_INVALID").max(MAX_QUANTITY, "QUANTITY_INVALID"),
  note: z.string().max(140, "TOO_LONG").default("").transform(sanitizeMultiline),
})

export const CreateOrderSchema = z
  .object({
    idempotencyKey: z.uuid(),
    locale: z.enum(i18n.locales),
    name: z
      .string()
      .transform(sanitizeInput)
      .pipe(z.string().min(2, "NAME_INVALID").max(60, "NAME_INVALID")),
    phone: z.string().max(20, "PHONE_INVALID").transform((value, ctx) => {
      const normalized = normalizeRwandaPhone(value)
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "PHONE_INVALID" })
        return z.NEVER
      }
      return normalized
    }),
    fulfillment: z.enum(["PICKUP", "DELIVERY"]),
    address: z.string().max(200, "TOO_LONG").optional().transform((v) => (v ? sanitizeInput(v) : "")),
    paymentMethod: z.enum(["CASH", "MOMO"]),
    note: z.string().max(280, "TOO_LONG").optional().transform((v) => (v ? sanitizeMultiline(v) : "")),
    lines: z.array(CartLineInputSchema).min(1, "EMPTY_CART").max(MAX_LINES, "TOO_LONG"),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "DELIVERY" && data.address.length < 5) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "ADDRESS_REQUIRED" })
    }
  })

export type CreateOrderInput = z.input<typeof CreateOrderSchema>
export type CreateOrderData = z.output<typeof CreateOrderSchema>

/** First error code per field path — the shape ActionResponse.errors carries. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_"
    if (!out[key]) out[key] = /^[A-Z_]+$/.test(issue.message) ? issue.message : "VALIDATION"
  }
  return out
}

/**
 * Client-side mirror of the customer fields, for instant feedback in the
 * checkout form. The server re-validates everything with CreateOrderSchema.
 */
export const CheckoutFormSchema = z
  .object({
    name: z.string().trim().min(2, "NAME_INVALID").max(60, "NAME_INVALID"),
    phone: z.string().refine((v) => !!normalizeRwandaPhone(v), "PHONE_INVALID"),
    fulfillment: z.enum(["PICKUP", "DELIVERY"]),
    address: z.string().max(200, "TOO_LONG"),
    paymentMethod: z.enum(["CASH", "MOMO"]),
    note: z.string().max(280, "TOO_LONG"),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "DELIVERY" && data.address.trim().length < 5) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "ADDRESS_REQUIRED" })
    }
  })

export type CheckoutFormValues = z.infer<typeof CheckoutFormSchema>
