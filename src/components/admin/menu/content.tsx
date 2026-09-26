"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { Price } from "@/components/atom/price"
import { localeConfig, type Locale } from "@/components/internationalization/config"
import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import { useAdminAction } from "../use-admin-action"
import { setItemAvailability } from "./actions"
import type { AdminItemRow } from "./queries"

export function AdminMenuContent({ lang, items }: { lang: Locale; items: AdminItemRow[] }) {
  const dict = useDictionary()
  const t = dict?.admin?.menu
  const { run } = useAdminAction()
  const [showArchived, setShowArchived] = useState(false)
  const visible = items.filter((i) => showArchived || !i.isArchived)
  const groups = visible.reduce<Record<string, AdminItemRow[]>>((acc, item) => {
    ;(acc[item.categoryName] ??= []).push(item)
    return acc
  }, {})

  return (
    <main id="main-content" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-2xl lg:text-3xl">{t?.title}</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            {t?.showArchived}
          </label>
          <Button asChild variant="black" className="rounded-full">
            <Link href={`/${lang}/admin/menu/new`}>
              <Plus />
              {t?.addItem}
            </Link>
          </Button>
        </div>
      </div>

      {visible.length === 0 && <p className="py-12 text-center">{t?.noItems}</p>}

      {Object.entries(groups).map(([category, rows]) => (
        <section key={category} className="rounded-2xl border bg-background">
          <h2 className="border-b px-4 py-3 text-base font-semibold sm:text-base lg:text-base">{category}</h2>
          <ul className="divide-y">
            {rows.map((item) => (
              <li key={item.id} className={cn("flex items-center gap-3 px-4 py-3", item.isArchived && "opacity-60")} data-testid="admin-item" data-slug={item.slug}>
                <Link href={`/${lang}/admin/menu/${item.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {item.name}
                    {item.isArchived && <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-xs">{t?.archived}</span>}
                  </p>
                  <p className="text-sm">
                    <Price amount={item.price} />
                    {item.missingLocales.length > 0 && (
                      <span className="ms-2 text-xs text-amber-700">
                        {interpolate(t?.missing ?? "Missing: {locales}", {
                          locales: item.missingLocales.map((l) => localeConfig[l].nativeName).join(", "),
                        })}
                      </span>
                    )}
                  </p>
                </Link>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <span className="hidden sm:inline">{item.isAvailable ? t?.available : dict?.order?.soldOut}</span>
                  <Switch
                    checked={item.isAvailable}
                    disabled={item.isArchived}
                    onCheckedChange={(checked) => run(() => setItemAvailability(item.id, checked))}
                    aria-label={`${t?.available} ${item.name}`}
                    data-testid="availability"
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
