import * as z from "zod"

import { TRACKING_TOKEN_PATTERN } from "@/lib/order/token"

/** Guest asks for a MoMo prompt. No phone = use the number from checkout. */
export const StartMomoSchema = z.object({
  token: z.string().regex(TRACKING_TOKEN_PATTERN),
  phone: z.string().trim().max(20, "MOMO_NUMBER_INVALID").optional(),
})

/** Guest switches an order still waiting for its MoMo PIN to cash. */
export const PayCashSchema = z.object({
  token: z.string().regex(TRACKING_TOKEN_PATTERN),
})
