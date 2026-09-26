"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { isLocale, LOCALE_SEGMENT, type Locale } from "./config"

/** Persist the locale preference and move to the same path in that locale. */
export async function setLocale(locale: Locale, pathname: string) {
  if (!isLocale(locale)) throw new Error(`Invalid locale: ${locale}`)

  const cookieStore = await cookies()
  cookieStore.set("NEXT_LOCALE", locale, {
    maxAge: 31536000,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })

  const safePath = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/"
  redirect(LOCALE_SEGMENT.test(safePath) ? safePath.replace(LOCALE_SEGMENT, `/${locale}`) : `/${locale}${safePath}`)
}
