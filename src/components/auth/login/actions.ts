"use server"

import { AuthError } from "next-auth"

import { signIn, signOut } from "@/auth"
import { toLocale } from "@/components/internationalization/config"
import { fail, type ActionResponse } from "@/lib/action-response"
import { db } from "@/lib/db"
import { assertRateLimit, getClientId, RateLimitError } from "@/lib/rate-limit"
import { HOME_BY_ROLE } from "@/routes"

import { LoginSchema } from "../validation"

/** Only same-origin, locale-prefixed staff paths — never an open redirect. */
function safeCallback(callbackUrl: unknown, lang: string): string | null {
  if (typeof callbackUrl !== "string") return null
  if (!callbackUrl.startsWith(`/${lang}/`) || callbackUrl.startsWith("//") || callbackUrl.includes("\\")) return null
  return callbackUrl
}

/** Staff sign-in (mkan login action, credentials only). Redirects on success. */
export async function login(input: unknown, langInput: string, callbackUrl?: string): Promise<ActionResponse<null>> {
  const lang = toLocale(langInput)
  try {
    await assertRateLimit("auth", await getClientId())
  } catch (error) {
    if (error instanceof RateLimitError) return fail("RATE_LIMITED")
    throw error
  }

  const parsed = LoginSchema.safeParse(input)
  if (!parsed.success) return fail("INVALID_CREDENTIALS")

  // Role only decides where to land; authentication happens in authorize().
  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { role: true } })
  const home = user ? `/${lang}${HOME_BY_ROLE[user.role]}` : `/${lang}/login`

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCallback(callbackUrl, lang) ?? home,
    })
  } catch (error) {
    if (error instanceof AuthError) return fail("INVALID_CREDENTIALS")
    throw error // NEXT_REDIRECT on success
  }
  return fail("GENERIC")
}

export async function logout(langInput: string) {
  await signOut({ redirectTo: `/${toLocale(langInput)}/login` })
}
