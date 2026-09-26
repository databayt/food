import { notFound } from "next/navigation"

import { ModifiersContent } from "@/components/admin/modifiers/content"
import { draftFrom } from "@/components/admin/translation-fields"
import { isLocale } from "@/components/internationalization/config"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function ModifiersPage({ params }: PageProps<"/[lang]/admin/modifiers">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ["ADMIN"])
  const groups = await db.modifierGroup.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      translations: true,
      options: { orderBy: { sortOrder: "asc" }, include: { translations: true } },
      _count: { select: { items: true } },
    },
  })
  return (
    <ModifiersContent
      groups={groups.map((g) => ({
        id: g.id,
        slug: g.slug,
        sortOrder: g.sortOrder,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        usedBy: g._count.items,
        translations: draftFrom(g.translations),
        options: g.options.map((o) => ({
          id: o.id,
          slug: o.slug,
          sortOrder: o.sortOrder,
          price: o.price,
          isAvailable: o.isAvailable,
          translations: draftFrom(o.translations),
        })),
      }))}
    />
  )
}
