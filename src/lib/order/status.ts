import type { OrderStatus, UserRole } from "@prisma/client"

/**
 * The order state machine — the single source of truth for which transitions
 * exist and who may perform them. Server actions consult it before writing;
 * the UI uses it to pick the one "next action" button.
 *
 *   NEW → CONFIRMED → PREPARING → READY → COMPLETED
 *   any non-terminal → CANCELLED
 */
export const ORDER_FLOW = ["NEW", "CONFIRMED", "PREPARING", "READY", "COMPLETED"] as const satisfies readonly OrderStatus[]

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["COMPLETED", "CANCELLED"]
export const ACTIVE_STATUSES: readonly OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "READY"]

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
}

/** Forward transitions the kitchen may perform. */
const KITCHEN_TRANSITIONS: ReadonlyArray<[OrderStatus, OrderStatus]> = [
  ["CONFIRMED", "PREPARING"],
  ["PREPARING", "READY"],
]

export function nextStatus(status: OrderStatus): OrderStatus | null {
  return NEXT[status] ?? null
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/** Is `from → to` a legal edge of the state machine (ignoring roles)? */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "CANCELLED") return !isTerminal(from)
  return NEXT[from] === to
}

/** Is `role` allowed to move an order `from → to`? */
export function canTransition(from: OrderStatus, to: OrderStatus, role: UserRole): boolean {
  if (!isValidTransition(from, to)) return false
  if (role === "ADMIN" || role === "CASHIER") return true
  if (role === "KITCHEN") return KITCHEN_TRANSITIONS.some(([f, t]) => f === from && t === to)
  return false
}

/** Timestamp column stamped when an order enters `status`. */
export const STATUS_TIMESTAMP: Partial<Record<OrderStatus, "confirmedAt" | "preparingAt" | "readyAt" | "completedAt" | "cancelledAt">> = {
  CONFIRMED: "confirmedAt",
  PREPARING: "preparingAt",
  READY: "readyAt",
  COMPLETED: "completedAt",
  CANCELLED: "cancelledAt",
}
