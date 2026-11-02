import type { UserRole } from "@/generated/prisma/client"

import { ROUTE_ROLES } from "@/routes"

export type StaffNavKey = "queue" | "pos" | "kitchen" | "admin"

export const STAFF_NAV: { key: StaffNavKey; href: string; roles: readonly UserRole[] }[] = [
  { key: "queue", href: "/cashier", roles: ROUTE_ROLES.cashier },
  { key: "pos", href: "/cashier/pos", roles: ROUTE_ROLES.cashier },
  { key: "kitchen", href: "/kitchen", roles: ROUTE_ROLES.kitchen },
  { key: "admin", href: "/admin", roles: ROUTE_ROLES.admin },
]

export function navFor(role: UserRole) {
  return STAFF_NAV.filter((item) => item.roles.includes(role))
}

/** The one tab to highlight: the longest href the path sits under (/cashier/pos ≠ /cashier). */
export function activeNavHref(pathname: string, base: string, hrefs: string[]): string | null {
  const hits = hrefs.filter((h) => pathname === `${base}${h}` || pathname.startsWith(`${base}${h}/`))
  return hits.sort((a, b) => b.length - a.length)[0] ?? null
}
