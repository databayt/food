import "server-only"

import { AuthError } from "next-auth"

import { signIn } from "@/auth"
import { toLocale } from "@/components/internationalization/config"
import { db } from "@/lib/db"
import { assertRateLimit, getClientId, RateLimitError } from "@/lib/rate-limit"
import { HOME_BY_ROLE } from "@/routes"

import { LoginSchema } from "../validation"

/** Only same-origin, locale-prefixed staff paths — never an open redirect. */
export function safeCallback(callbackUrl: unknown, lang: string): string | null {
  if (typeof callbackUrl !== "string") return null
  if (!callbackUrl.startsWith(`/${lang}/`) || callbackUrl.startsWith("//") || callbackUrl.includes("\\")) return null
  return callbackUrl
}

export type AuthResult = { ok: true; to: string } | { ok: false; error: "INVALID_CREDENTIALS" | "RATE_LIMITED" | "GENERIC" }

/**
 * Check the credentials and start the session (cookie), WITHOUT redirecting:
 * the server action and the no-JS route handler each answer in their own way.
 */
export async function authenticate(input: unknown, langInput: string, callbackUrl?: unknown): Promise<AuthResult> {
  const lang = toLocale(langInput)
  try {
    await assertRateLimit("auth", await getClientId())
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, error: "RATE_LIMITED" }
    throw error
  }

  const parsed = LoginSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_CREDENTIALS" }

  // Role only decides where to land; authentication happens in authorize().
  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { role: true } })
  const home = user ? `/${lang}${HOME_BY_ROLE[user.role]}` : `/${lang}/login`

  try {
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false })
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: "INVALID_CREDENTIALS" }
    console.error("[login] failed", error)
    return { ok: false, error: "GENERIC" }
  }
  return { ok: true, to: safeCallback(callbackUrl, lang) ?? home }
}
