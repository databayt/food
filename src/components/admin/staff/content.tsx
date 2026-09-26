"use client"

import { useState } from "react"
import type { UserRole } from "@prisma/client"
import { Loader2, Plus } from "lucide-react"

import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { useAdminAction } from "../use-admin-action"
import { createStaff, updateStaff } from "./actions"

export type StaffRow = { id: string; name: string; email: string; role: UserRole; isActive: boolean }
const ROLES: UserRole[] = ["CASHIER", "KITCHEN", "ADMIN"]

function RoleSelect({ id, value, onChange }: { id: string; value: UserRole; onChange: (r: UserRole) => void }) {
  const dict = useDictionary()
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as UserRole)} className="h-9 rounded-md border bg-background px-3 text-sm">
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {dict?.enums?.userRole?.[r] ?? r}
        </option>
      ))}
    </select>
  )
}

export function StaffContent({ staff, currentUserId }: { staff: StaffRow[]; currentUserId: string }) {
  const dict = useDictionary()
  const t = dict?.admin?.staff
  const { run, pending, errorText } = useAdminAction()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: "", email: "", password: "", role: "CASHIER" as UserRole })
  const [error, setError] = useState<string | null>(null)

  return (
    <main id="main-content" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-2xl lg:text-3xl">{t?.title}</h1>
        {!adding && (
          <Button variant="black" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus />
            {t?.add}
          </Button>
        )}
      </div>

      {adding && (
        <section className="grid gap-3 rounded-2xl border bg-background p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ns-name">{t?.name}</Label>
            <Input id="ns-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-email">{t?.email}</Label>
            <Input id="ns-email" type="email" dir="ltr" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-password">{t?.password}</Label>
            <Input id="ns-password" type="password" dir="ltr" autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ns-role">{t?.role}</Label>
            <RoleSelect id="ns-role" value={draft.role} onChange={(role) => setDraft({ ...draft, role })} />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{errorText(error)}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button
              className="rounded-full"
              disabled={pending}
              onClick={() => {
                setError(null)
                run(
                  async () => {
                    const res = await createStaff(draft)
                    if (!res.success) setError(res.error)
                    return res
                  },
                  {
                    onSuccess: () => {
                      setAdding(false)
                      setDraft({ name: "", email: "", password: "", role: "CASHIER" })
                    },
                  }
                )
              }}
            >
              {pending && <Loader2 className="animate-spin" />}
              {dict?.common?.create}
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => setAdding(false)}>
              {dict?.common?.cancel}
            </Button>
          </div>
        </section>
      )}

      <ul className="space-y-3">
        {staff.map((s) => (
          <StaffCard key={s.id} row={s} isSelf={s.id === currentUserId} />
        ))}
      </ul>
    </main>
  )
}

function StaffCard({ row, isSelf }: { row: StaffRow; isSelf: boolean }) {
  const dict = useDictionary()
  const t = dict?.admin?.staff
  const { run, pending, errorText } = useAdminAction()
  const [v, setV] = useState({ name: row.name, role: row.role, isActive: row.isActive, password: "" })
  const [error, setError] = useState<string | null>(null)

  return (
    <li className="space-y-3 rounded-2xl border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-foreground">
          {row.name}
          {isSelf && <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-xs">{t?.you}</span>}
        </p>
        <p className="text-sm" dir="ltr">
          {row.email}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`sn-${row.id}`}>{t?.name}</Label>
          <Input id={`sn-${row.id}`} className="w-48" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sr-${row.id}`}>{t?.role}</Label>
          <RoleSelect id={`sr-${row.id}`} value={v.role} onChange={(role) => setV({ ...v, role })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`sp-${row.id}`}>{t?.newPassword}</Label>
          <Input id={`sp-${row.id}`} type="password" dir="ltr" autoComplete="new-password" className="w-56" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Switch checked={v.isActive} onCheckedChange={(isActive) => setV({ ...v, isActive })} disabled={isSelf} />
          {t?.active}
        </label>
        <Button
          className="ms-auto rounded-full"
          disabled={pending}
          onClick={() => {
            setError(null)
            run(async () => {
              const res = await updateStaff(row.id, v)
              if (!res.success) setError(res.error)
              return res
            })
          }}
        >
          {pending && <Loader2 className="animate-spin" />}
          {dict?.common?.save}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{errorText(error)}</p>}
    </li>
  )
}
