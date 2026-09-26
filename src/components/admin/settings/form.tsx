"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { formatLocalPhone } from "@/lib/order/phone"

import { useAdminAction } from "../use-admin-action"
import { updateSettings } from "./actions"
import type { SettingsInput } from "./validation"

type Initial = Omit<SettingsInput, "deliveryFee"> & { deliveryFee: number }

export function SettingsForm({ initial }: { initial: Initial }) {
  const dict = useDictionary()
  const t = dict?.admin?.settings
  const { run, pending, errorText } = useAdminAction()
  const [v, setV] = useState({
    ...initial,
    phone: initial.phone ? formatLocalPhone(initial.phone) : "",
    whatsappNumber: initial.whatsappNumber ? formatLocalPhone(initial.whatsappNumber) : "",
    deliveryFee: String(initial.deliveryFee),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((prev) => ({ ...prev, [key]: value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    run(async () => {
      const res = await updateSettings(v)
      if (!res.success && res.errors) setErrors(res.errors)
      return res
    })
  }

  const text = (key: keyof typeof v, label: string | undefined, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`s-${key}`}>{label}</Label>
      <Input id={`s-${key}`} value={String(v[key])} onChange={(e) => set(key, e.target.value as never)} aria-invalid={!!errors[key]} {...props} />
      {errors[key] && <p className="text-sm text-destructive">{errorText(errors[key])}</p>}
    </div>
  )

  const toggle = (key: keyof typeof v, label: string | undefined, hint?: string) => (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={Boolean(v[key])} onCheckedChange={(checked) => set(key, checked as never)} data-testid={`toggle-${key}`} />
    </label>
  )

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4 rounded-2xl border bg-background p-4">
        <h2 className="text-lg font-semibold sm:text-lg lg:text-lg">{t?.ordering}</h2>
        <div className="divide-y">
          {toggle("isOpen", t?.isOpen, t?.isOpenHint)}
          {toggle("pickupEnabled", t?.pickupEnabled)}
          {toggle("deliveryEnabled", t?.deliveryEnabled)}
        </div>
        {text("deliveryFee", t?.deliveryFee, { inputMode: "numeric", dir: "ltr" })}
        <p className="text-sm">{t?.deliveryFeeHint}</p>
      </section>

      <section className="space-y-2 rounded-2xl border bg-background p-4">
        <h2 className="text-lg font-semibold sm:text-lg lg:text-lg">{t?.payments}</h2>
        <div className="divide-y">
          {toggle("cashEnabled", t?.cashEnabled)}
          {toggle("momoEnabled", t?.momoEnabled)}
        </div>
        {text("momoCode", t?.momoCode, { inputMode: "numeric", dir: "ltr" })}
      </section>

      <section className="grid gap-4 rounded-2xl border bg-background p-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2 sm:text-lg lg:text-lg">{t?.general}</h2>
        {text("name", t?.name)}
        {text("address", t?.address)}
        {text("phone", t?.phone, { type: "tel", dir: "ltr" })}
        {text("whatsappNumber", t?.whatsapp, { type: "tel", dir: "ltr" })}
        {text("tiktok", t?.tiktok, { dir: "ltr" })}
        {text("logoUrl", t?.logoUrl, { dir: "ltr", type: "url" })}
      </section>

      <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-full px-8" data-testid="save-settings">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? dict?.common?.saving : dict?.common?.save}
      </Button>
    </form>
  )
}
