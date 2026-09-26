"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"

import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { emptyDraft, TranslationFields, type TranslationDraft } from "../translation-fields"
import { useAdminAction } from "../use-admin-action"
import { saveGroup, saveOption } from "./actions"

export type OptionRow = { id: string | null; slug: string; sortOrder: number; price: number; isAvailable: boolean; translations: TranslationDraft }
export type GroupRow = {
  id: string | null
  slug: string
  sortOrder: number
  minSelect: number
  maxSelect: number
  usedBy: number
  translations: TranslationDraft
  options: OptionRow[]
}

export function ModifiersContent({ groups }: { groups: GroupRow[] }) {
  const dict = useDictionary()
  const t = dict?.admin?.modifiers
  const [adding, setAdding] = useState(false)
  return (
    <main id="main-content" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-2xl lg:text-3xl">{t?.title}</h1>
        {!adding && (
          <Button variant="black" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus />
            {t?.addGroup}
          </Button>
        )}
      </div>
      {adding && (
        <GroupCard
          group={{ id: null, slug: "", sortOrder: (groups.length + 1) * 10, minSelect: 0, maxSelect: 1, usedBy: 0, translations: emptyDraft(), options: [] }}
          onSaved={() => setAdding(false)}
        />
      )}
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} />
      ))}
    </main>
  )
}

function GroupCard({ group, onSaved }: { group: GroupRow; onSaved?: () => void }) {
  const dict = useDictionary()
  const t = dict?.admin?.modifiers
  const { run, pending, errorText } = useAdminAction()
  const [v, setV] = useState({ ...group, sortOrder: String(group.sortOrder), minSelect: String(group.minSelect), maxSelect: String(group.maxSelect) })
  const [error, setError] = useState<string | null>(null)
  const [addingOption, setAddingOption] = useState(false)

  const save = () => {
    setError(null)
    run(
      async () => {
        const res = await saveGroup(group.id, v)
        if (!res.success) setError(res.error)
        return res
      },
      { onSuccess: onSaved }
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-background p-4">
      <TranslationFields idPrefix={`grp-${group.id ?? "new"}`} value={v.translations} onChange={(translations) => setV({ ...v, translations })} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`gs-${group.id}`}>{dict?.admin?.menu?.slug}</Label>
          <Input id={`gs-${group.id}`} dir="ltr" className="w-40" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value.toLowerCase() })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`gmin-${group.id}`}>{t?.minSelect}</Label>
          <Input id={`gmin-${group.id}`} dir="ltr" inputMode="numeric" className="w-24" value={v.minSelect} onChange={(e) => setV({ ...v, minSelect: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`gmax-${group.id}`}>{t?.maxSelect}</Label>
          <Input id={`gmax-${group.id}`} dir="ltr" inputMode="numeric" className="w-24" value={v.maxSelect} onChange={(e) => setV({ ...v, maxSelect: e.target.value })} />
        </div>
        {group.id && <span className="h-9 content-center text-sm">{interpolate(t?.usedBy ?? "Used by {count} items", { count: group.usedBy })}</span>}
        <Button className="ms-auto rounded-full" onClick={save} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {dict?.common?.save}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{errorText(error)}</p>}

      {group.id && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold sm:text-sm lg:text-sm">{t?.options}</h3>
            {!addingOption && (
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setAddingOption(true)}>
                <Plus />
                {t?.addOption}
              </Button>
            )}
          </div>
          {addingOption && (
            <OptionEditor
              groupId={group.id}
              option={{ id: null, slug: `${group.slug}-`, sortOrder: (group.options.length + 1) * 10, price: 0, isAvailable: true, translations: emptyDraft() }}
              onSaved={() => setAddingOption(false)}
            />
          )}
          {group.options.map((o) => (
            <OptionEditor key={o.id} groupId={group.id!} option={o} />
          ))}
        </div>
      )}
    </section>
  )
}

function OptionEditor({ groupId, option, onSaved }: { groupId: string; option: OptionRow; onSaved?: () => void }) {
  const dict = useDictionary()
  const t = dict?.admin?.modifiers
  const { run, pending, errorText } = useAdminAction()
  const [v, setV] = useState({ ...option, price: String(option.price), sortOrder: String(option.sortOrder) })
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-3 rounded-xl bg-muted/50 p-3">
      <TranslationFields idPrefix={`opt-${option.id ?? "new"}`} value={v.translations} onChange={(translations) => setV({ ...v, translations })} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`os-${option.id}`}>{dict?.admin?.menu?.slug}</Label>
          <Input id={`os-${option.id}`} dir="ltr" className="w-40 bg-background" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value.toLowerCase() })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`op-${option.id}`}>{t?.optionPrice}</Label>
          <Input id={`op-${option.id}`} dir="ltr" inputMode="numeric" className="w-32 bg-background" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Switch checked={v.isAvailable} onCheckedChange={(isAvailable) => setV({ ...v, isAvailable })} />
          {dict?.admin?.menu?.available}
        </label>
        <Button
          size="sm"
          className="ms-auto rounded-full"
          disabled={pending}
          onClick={() => {
            setError(null)
            run(
              async () => {
                const res = await saveOption(groupId, option.id, v)
                if (!res.success) setError(res.error)
                return res
              },
              { onSuccess: onSaved }
            )
          }}
        >
          {pending && <Loader2 className="animate-spin" />}
          {dict?.common?.save}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{errorText(error)}</p>}
    </div>
  )
}
