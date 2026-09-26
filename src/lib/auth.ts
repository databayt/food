import "server-only"

import type { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { HOME_BY_ROLE } from "@/routes"

export { auth }

export type StaffSession = { user: { id: string; role: UserRole; name?: string | null } }

export function hasRole(role: UserRole | undefined, roles: readonly UserRole[]): boolean {
  return !!role && roles.includes(role)
}

/**
 * Page/layout guard (mkan `auth-guard.ts`). Anonymous → login. Signed in but
 * the wrong role → that role's own home (never a loop: every role's home
 * admits that role).
 */
export async function requireRole(locale: string, roles: readonly UserRole[]): Promise<StaffSession> {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) redirect(`/${locale}/login`)
  if (!hasRole(session.user.role, roles)) redirect(`/${locale}${HOME_BY_ROLE[session.user.role]}`)
  return session as StaffSession
}

/** Action guard: returns the session or null — callers return FORBIDDEN. */
export async function getStaffSession(roles: readonly UserRole[]): Promise<StaffSession | null> {
  const session = await auth()
  if (!session?.user?.id || !hasRole(session.user.role, roles)) return null
  return session as StaffSession
}
