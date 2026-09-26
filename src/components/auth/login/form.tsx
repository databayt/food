"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import type { Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { login } from "./actions"

export function LoginForm({ lang, callbackUrl, denied }: { lang: Locale; callbackUrl?: string; denied?: boolean }) {
  const dict = useDictionary()
  const [error, setError] = useState<string | null>(denied ? (dict?.auth?.denied ?? null) : null)
  const [pending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await login({ email: data.get("email"), password: data.get("password") }, lang, callbackUrl)
      if (res && !res.success) {
        setError(
          res.error === "INVALID_CREDENTIALS"
            ? (dict?.auth?.invalid ?? "Wrong email or password.")
            : ((dict?.errors as Record<string, string> | undefined)?.[res.error] ?? dict?.errors?.GENERIC ?? null)
        )
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
