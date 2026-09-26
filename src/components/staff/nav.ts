import type { UserRole } from "@prisma/client"

import { ROUTE_ROLES } from "@/routes"

export type StaffNavKey = "queue" | "kitchen" | "admin"

export const STAFF_NAV: { key: StaffNavKey; href: string; roles: readonly UserRole[] }[] = [
  { key: "queue", href: "/cashier", roles: ROUTE_ROLES.cashier },
  { key: "kitchen", href: "/kitchen", roles: ROUTE_ROLES.kitchen },
  { key: "admin", href: "/admin", roles: ROUTE_ROLES.admin },
]

export function navFor(role: UserRole) {
  return STAFF_NAV.filter((item) => item.roles.includes(role))
}
