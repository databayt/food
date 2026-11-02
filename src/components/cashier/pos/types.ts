import type { FulfillmentType, OrderStatus, PaymentAttemptStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/client"

/** What the counter prints: the order as stored, never the client's numbers. */
export type PosReceipt = {
  number: number
  placedAt: string
  fulfillment: FulfillmentType
  customerName: string
  items: { id: string; name: string; quantity: number; lineTotal: number; modifiers: string[] }[]
  subtotal: number
  deliveryFee: number
  total: number
}

/** A rung-up ticket as the POS follows it: waiting for MoMo, then placed. */
export type PosResult = {
  orderId: string
  token: string
  number: number
  status: OrderStatus
  fulfillment: FulfillmentType
  total: number
  payment: { method: PaymentMethod; status: PaymentStatus; reference: string | null }
  /** Latest MoMo prompt (payer number not exposed). */
  attempt: { status: PaymentAttemptStatus; reason: string | null; createdAt: string } | null
  /** Set once the order reached the kitchen. */
  receipt: PosReceipt | null
  /** Cash handed back, when the cashier took cash. */
  change: number | null
}
