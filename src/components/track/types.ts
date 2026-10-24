import type { FulfillmentType, OrderStatus, PaymentAttemptStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/client"

/** Customer-safe order view. Never carries phone numbers or addresses. */
export type TrackedOrder = {
  number: number
  status: OrderStatus
  fulfillment: FulfillmentType
  firstName: string
  createdAt: string
  updatedAt: string
  /** Delivery only: the rider left with the order. */
  dispatchedAt: string | null
  subtotal: number
  deliveryFee: number
  total: number
  payment: {
    method: PaymentMethod
    status: PaymentStatus
    /** MoMo receipt number once paid (financialTransactionId or cashier entry). */
    reference: string | null
    /** Latest MoMo PIN prompt, if one was sent. The payer number is never exposed. */
    attempt: { status: PaymentAttemptStatus; reason: string | null; createdAt: string } | null
  } | null
  items: {
    id: string
    name: string
    quantity: number
    lineTotal: number
    note: string | null
    modifiers: string[]
  }[]
}
