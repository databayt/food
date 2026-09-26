"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { useLocale } from "@/components/internationalization/use-locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { uploadMenuImage } from "@/lib/image-upload-client"

import { TranslationFields, type TranslationDraft } from "../translation-fields"
import { useAdminAction } from "../use-admin-action"
import { createItem, setItemArchived, updateItem } from "./actions"
import type { EditorOptions } from "./queries"

export type ItemDraft = {
  slug: string
  categoryId: string
  price: string
  imageUrl: string
  sortOrder: string
  isAvailable: boolean
  isNew: boolean
  isArchived: boolean
  groupIds: string[]
  translations: TranslationDraft
}

export function ItemForm({
  lang,
  itemId,
  initial,
  options,
  sourceLabel,
}: {
  lang: Locale
  itemId: string | null
  initial: ItemDraft
  options: EditorOptions
  sourceLabel?: string
}) {
  const dict = useDictionary()
  const t = dict?.admin?.menu
  const router = useRouter()
  const { isRTL } = useLocale()
  const { run, pending, errorText } = useAdminAction()
  const [v, setV] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const Back = isRTL ? ArrowRight : ArrowLeft
  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => setV((prev) => ({ ...prev, [key]: value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    const payload = { ...v, isArchived: undefined }
    run(
      async () => {
        const res = itemId ? await updateItem(itemId, payload) : await createItem(payload)
        if (!res.success && res.errors) setErrors(res.errors)
        return res
      },
      { onSuccess: (data) => !itemId && router.replace(`/${lang}/admin/menu/${data.id}`) }
    )
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      set("imageUrl", await uploadMenuImage(file))
    } catch (error) {
      toast.error(errorText(error instanceof Error ? error.message : "UPLOAD_FAILED"))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const err = (key: string) => errors[key] && <p className="text-sm text-destructive">{errorText(errors[key])}</p>

  return (
    <form onSubmit={submit} className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2 px-2">
        <Link href={`/${lang}/admin/menu`}>
          <Back />
          {t?.backToList}
        </Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold sm:text-2xl lg:text-3xl">{itemId ? t?.editItem : t?.addItem}</h1>
        {sourceLabel && <span className="rounded-full bg-muted px-3 py-1 text-xs">{sourceLabel}</span>}
      </div>

      <section className="space-y-3 rounded-2xl border bg-background p-4">
        <h2 className="text-base font-semibold sm:text-base lg:text-base">{t?.translations}</h2>
        <TranslationFields idPrefix="item" value={v.translations} onChange={(next) => set("translations", next)} withDescription />
        {err("translations.en.name")}
        <p className="text-xs">{t?.fallbackNote}</p>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-background p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="price">{t?.price}</Label>
          <Input id="price" inputMode="numeric" dir="ltr" value={v.price} onChange={(e) => set("price", e.target.value)} data-testid="item-price" />
          {err("price")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">{t?.category}</Label>
          <select
            id="category"
            value={v.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">{t?.slug}</Label>
          <Input id="slug" dir="ltr" value={v.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} />
          {err("slug")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">{t?.sortOrder}</Label>
          <Input id="sortOrder" inputMode="numeric" dir="ltr" value={v.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:col-span-2">
          <span>
            <span className="block font-medium text-foreground">{t?.available}</span>
            <span className="block text-sm">{t?.availableHint}</span>
          </span>
          <Switch checked={v.isAvailable} onCheckedChange={(c) => set("isAvailable", c)} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:col-span-2">
          <span className="font-medium text-foreground">{t?.isNew}</span>
          <Switch checked={v.isNew} onCheckedChange={(c) => set("isNew", c)} />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border bg-background p-4">
        <h2 className="text-base font-semibold sm:text-base lg:text-base">{t?.image}</h2>
        <div className="flex flex-wrap items-center gap-4">
          {v.imageUrl ? (
            <div className="relative size-24 overflow-hidden rounded-xl bg-muted">
              <Image src={v.imageUrl} alt="" fill sizes="96px" className="object-cover" />
            </div>
          ) : null}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button type="button" variant="outline" className="rounded-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {t?.uploadImage}
          </Button>
          {v.imageUrl && (
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => set("imageUrl", "")}>
              <Trash2 />
              {t?.removeImage}
            </Button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="imageUrl">{t?.imageUrl}</Label>
          <Input id="imageUrl" dir="ltr" type="url" value={v.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
          {err("imageUrl")}
        </div>
      </section>

      {options.groups.length > 0 && (
        <section className="space-y-3 rounded-2xl border bg-background p-4">
          <h2 className="text-base font-semibold sm:text-base lg:text-base">{t?.modifierGroups}</h2>
          <div className="flex flex-wrap gap-2">
            {options.groups.map((g) => {
              const checked = v.groupIds.includes(g.id)
              return (
                <label key={g.id} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={checked}
                    onChange={() => set("groupIds", checked ? v.groupIds.filter((id) => id !== g.id) : [...v.groupIds, g.id])}
                  />
                  {g.name}
                </label>
              )
            })}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || uploading} className="h-12 rounded-full px-8" data-testid="save-item">
          {pending && <Loader2 className="animate-spin" />}
          {pending ? dict?.common?.saving : dict?.common?.save}
        </Button>
        {itemId && (
          <Button
            type="button"
            variant="outline"
            className="ms-auto rounded-full"
            disabled={pending}
            onClick={() => run(() => setItemArchived(itemId, !v.isArchived), { onSuccess: () => set("isArchived", !v.isArchived) })}
          >
            {v.isArchived ? t?.restore : t?.archive}
          </Button>
        )}
      </div>
    </form>
  )
}
