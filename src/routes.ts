/**
 * Route access map (paths WITHOUT the locale prefix). The proxy only checks
 * that a session cookie exists for protected prefixes; the real role check
 * happens in each staff layout (`requireRole`) and every staff server action.
 */
import type { UserRole } from "@prisma/client"

export const authRoutes = ["/login"]

export const protectedPrefixes = ["/cashier", "/kitchen", "/admin"]

export const apiAuthPrefix = "/api/auth"

/** Which roles may open each staff surface. */
export const ROUTE_ROLES = {
  cashier: ["ADMIN", "CASHIER"],
  kitchen: ["ADMIN", "CASHIER", "KITCHEN"],
  admin: ["ADMIN"],
} as const satisfies Record<string, readonly UserRole[]>

/** Where each role lands after login. */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "/cashier",
  CASHIER: "/cashier",
  KITCHEN: "/kitchen",
}
