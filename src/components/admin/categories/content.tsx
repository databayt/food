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
import { saveCategory } from "./actions"

export type CategoryRow = {
  id: string | null
  slug: string
  sortOrder: number
  isActive: boolean
  itemCount: number
  translations: TranslationDraft
}

export function CategoriesContent({ categories }: { categories: CategoryRow[] }) {
  const dict = useDictionary()
  const t = dict?.admin?.categories
  const [adding, setAdding] = useState(false)

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
        <CategoryCard
          row={{ id: null, slug: "", sortOrder: (categories.length + 1) * 10, isActive: true, itemCount: 0, translations: emptyDraft() }}
          onSaved={() => setAdding(false)}
        />
      )}
      {categories.map((c) => (
        <CategoryCard key={c.id} row={c} />
      ))}
    </main>
  )
}

function CategoryCard({ row, onSaved }: { row: CategoryRow; onSaved?: () => void }) {
  const dict = useDictionary()
  const t = dict?.admin?.categories
  const { run, pending, errorText } = useAdminAction()
  const [v, setV] = useState({ ...row, sortOrder: String(row.sortOrder) })
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    setError(null)
    run(
      async () => {
        const res = await saveCategory(row.id, v)
        if (!res.success) setError(res.error)
        return res
      },
      { onSuccess: onSaved }
    )
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-background p-4" data-testid="category-card">
      <TranslationFields idPrefix={`cat-${row.id ?? "new"}`} value={v.translations} onChange={(translations) => setV({ ...v, translations })} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`slug-${row.id}`}>{dict?.admin?.menu?.slug}</Label>
          <Input id={`slug-${row.id}`} dir="ltr" className="w-44" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value.toLowerCase() })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`sort-${row.id}`}>{t?.sortOrder}</Label>
          <Input id={`sort-${row.id}`} dir="ltr" inputMode="numeric" className="w-24" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: e.target.value })} />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Switch checked={v.isActive} onCheckedChange={(isActive) => setV({ ...v, isActive })} />
          {t?.active}
        </label>
        {row.id && <span className="h-9 content-center text-sm">{interpolate(t?.items ?? "{count} items", { count: row.itemCount })}</span>}
        <Button className="ms-auto rounded-full" onClick={save} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {dict?.common?.save}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{errorText(error)}</p>}
    </section>
  )
}
