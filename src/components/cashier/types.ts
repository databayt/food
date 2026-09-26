import type { FulfillmentType, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client"

export type QueueItem = {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  note: string | null
}

/** Cashier view of an order — includes contact details (cashier/admin only). */
export type CashierOrder = {
  id: string
  number: number
  status: OrderStatus
  fulfillment: FulfillmentType
  createdAt: string
  customerName: string
  customerPhone: string
  deliveryAddress: string | null
  note: string | null
  total: number
  cancelReason: string | null
  payment: { method: PaymentMethod; status: PaymentStatus; reference: string | null } | null
  items: QueueItem[]
}

/** Kitchen view — deliberately without phone, address, payment or totals. */
export type KitchenOrder = {
  id: string
  number: number
  status: OrderStatus
  createdAt: string
  note: string | null
  items: QueueItem[]
}
