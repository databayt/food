"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import type { Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { login } from "./actions"

/** Error codes the no-JS fallback can send back in `?error=`. */
const RETURNED = new Set(["INVALID_CREDENTIALS", "RATE_LIMITED", "GENERIC"])

export function LoginForm({
  lang,
  callbackUrl,
  denied,
  returnedError,
}: {
  lang: Locale
  callbackUrl?: string
  denied?: boolean
  /** `?error=` from the no-JS fallback (/api/staff-login). */
  returnedError?: string
}) {
  const dict = useDictionary()
  const errorText = (code: string) =>
    code === "INVALID_CREDENTIALS"
      ? (dict?.auth?.invalid ?? "Wrong email or password.")
      : ((dict?.errors as Record<string, string> | undefined)?.[code] ?? dict?.errors?.GENERIC ?? null)
  const [error, setError] = useState<string | null>(
    returnedError && RETURNED.has(returnedError) ? errorText(returnedError) : denied ? (dict?.auth?.denied ?? null) : null
  )
  const [pending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await login({ email: data.get("email"), password: data.get("password") }, lang, callbackUrl)
      if (res && !res.success) setError(errorText(res.error))
    })
  }

  return (
    // method + action only matter before hydration: the browser then POSTs the
    // body to the fallback route instead of a GET that would put the password
    // in the URL. After hydration onSubmit takes over (server action).
    <form method="post" action="/api/staff-login" onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="lang" value={lang} />
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <div className="space-y-2">
        <Label htmlFor="email">{dict?.auth?.email ?? "Email"}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required dir="ltr" className="h-12 text-base" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{dict?.auth?.password ?? "Password"}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" className="h-12 text-base" />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="h-12 w-full rounded-full text-base" data-testid="login-submit">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? (dict?.auth?.submitting ?? "Signing in…") : (dict?.auth?.submit ?? "Sign in")}
      </Button>
    </form>
  )
}
