import { NextResponse, type NextRequest } from "next/server"

import { authenticate } from "@/components/auth/login/authenticate"
import { toLocale } from "@/components/internationalization/config"

/**
 * No-JS fallback for the staff login form. The form posts here only when it
 * is submitted before the page hydrates (a slow counter phone, a fast Enter);
 * after hydration the client calls the server action instead. Credentials
 * come in the POST body — never in a URL — and the answer is always a 303 (a
 * 307 would make the browser re-post the password to the next page).
 * Cross-origin posts are already refused by the proxy's Origin check.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const lang = toLocale(String(form?.get("lang") ?? ""))
  const result = await authenticate(
    { email: form?.get("email"), password: form?.get("password") },
    lang,
    form?.get("callbackUrl") || undefined
  )
  const to = result.ok ? result.to : `/${lang}/login?error=${result.error}`
  return NextResponse.redirect(new URL(to, request.url), 303)
}
