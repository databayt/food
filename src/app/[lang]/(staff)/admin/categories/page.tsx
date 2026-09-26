import { notFound } from "next/navigation"

import { CategoriesContent } from "@/components/admin/categories/content"
import { draftFrom } from "@/components/admin/translation-fields"
import { isLocale } from "@/components/internationalization/config"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function CategoriesPage({ params }: PageProps<"/[lang]/admin/categories">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ["ADMIN"])
  const categories = await db.menuCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { translations: true, _count: { select: { items: { where: { isArchived: false } } } } },
  })
  return (
    <CategoriesContent
      categories={categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        itemCount: c._count.items,
        translations: draftFrom(c.translations),
      }))}
    />
  )
}
