import type { FulfillmentType, OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/client"

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
  /** When it reached the staff screens — the clock the queue runs on. */
  placedAt: string
  /** Empty for a counter walk-in. */
  customerName: string
  /** Null for a counter walk-in who gave no phone. */
  customerPhone: string | null
  deliveryAddress: string | null
  deliveryLat: number | null
  deliveryLng: number | null
  deliveryAccuracy: number | null
  /** Delivery only: when the rider left (the order stays READY until delivered). */
  dispatchedAt: string | null
  note: string | null
  total: number
  cancelReason: string | null
  /** `provider` set = confirmed by MTN itself (no cashier step); `reference` is the receipt. */
  payment: { method: PaymentMethod; status: PaymentStatus; reference: string | null; provider: string | null } | null
  items: QueueItem[]
}

/** Kitchen view — deliberately without phone, address, payment or totals. */
export type KitchenOrder = {
  id: string
  number: number
  status: OrderStatus
  fulfillment: FulfillmentType
  createdAt: string
  placedAt: string
  note: string | null
  items: QueueItem[]
}
