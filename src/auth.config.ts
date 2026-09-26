import bcrypt from "bcryptjs"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { LoginSchema } from "@/components/auth/validation"
import { db } from "@/lib/db"

/**
 * Staff-only credentials provider (ported from mkan's auth.config.ts; the
 * Google/Facebook providers and 2FA are intentionally not ported — customers
 * never sign in, and staff accounts are created by an admin).
 */
export default {
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await db.user.findUnique({ where: { email: parsed.data.email } })
        if (!user || !user.isActive) return null

        const matches = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!matches) return null

        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
} satisfies NextAuthConfig
