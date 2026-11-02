"use server"

import { redirect } from "next/navigation"

import { signOut } from "@/auth"
import { toLocale } from "@/components/internationalization/config"
import { fail, type ActionResponse } from "@/lib/action-response"

import { authenticate } from "./authenticate"

/** Staff sign-in (mkan login action, credentials only). Redirects on success. */
export async function login(input: unknown, langInput: string, callbackUrl?: string): Promise<ActionResponse<null>> {
  const result = await authenticate(input, langInput, callbackUrl)
  if (!result.ok) return fail(result.error)
  redirect(result.to)
}

export async function logout(langInput: string) {
  await signOut({ redirectTo: `/${toLocale(langInput)}/login` })
}
