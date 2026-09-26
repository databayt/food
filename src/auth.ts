import NextAuth from "next-auth"
import type { UserRole } from "@prisma/client"

import authConfig from "@/auth.config"
import { db } from "@/lib/db"

const isProduction = process.env.NODE_ENV === "production"

// Re-read role / isActive from the DB at most this often, so a deactivated or
// re-roled staff member loses access within minutes without a DB hit per request.
const REFRESH_MS = 5 * 60_000

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: {
      name: isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProduction },
    },
    callbackUrl: {
      name: isProduction ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProduction },
    },
    csrfToken: {
      name: isProduction ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProduction },
    },
  },
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  jwt: { maxAge: 30 * 24 * 60 * 60 },
  useSecureCookies: isProduction,
  events: {
    async signIn({ user }) {
      if (user.id) {
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {})
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role?: UserRole }).role
        token.checkedAt = Date.now()
        return token
      }
      if (!token.sub) return token

      const stale = !token.checkedAt || Date.now() - Number(token.checkedAt) > REFRESH_MS
      if (trigger === "update" || stale) {
        const existing = await db.user.findUnique({
          where: { id: token.sub },
          select: { role: true, isActive: true, name: true, email: true },
        })
        // Deactivated / deleted staff: strip the token → no id/role → guards reject.
        if (!existing || !existing.isActive) return {}
        token.role = existing.role
        token.name = existing.name
        token.email = existing.email
        token.checkedAt = Date.now()
      }
      return token
    },
    async session({ token, session }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub
        if (token.role) session.user.role = token.role as UserRole
      }
      return session
    },
  },
  ...authConfig,
})
