import * as z from "zod"

const OrderStatusEnum = z.enum(["NEW", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"])

export const TransitionSchema = z.object({
  orderId: z.string().min(1).max(40),
  /** The status the staff member saw — optimistic concurrency guard. */
  from: OrderStatusEnum,
  to: OrderStatusEnum,
  reason: z.string().max(200, "TOO_LONG").optional(),
})

export const MarkPaidSchema = z.object({
  orderId: z.string().min(1).max(40),
  reference: z.string().trim().max(60, "TOO_LONG").optional(),
})

export const RefundSchema = z.object({
  orderId: z.string().min(1).max(40),
})
