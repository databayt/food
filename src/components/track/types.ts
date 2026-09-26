import type { FulfillmentType, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client"

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
  payment: { method: PaymentMethod; status: PaymentStatus } | null
  items: {
    id: string
    name: string
    quantity: number
    lineTotal: number
    note: string | null
    modifiers: string[]
  }[]
}
