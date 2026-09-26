import { notFound } from "next/navigation"

import { ItemForm } from "@/components/admin/menu/form"
import { getAdminItem, getEditorOptions } from "@/components/admin/menu/queries"
import { draftFrom } from "@/components/admin/translation-fields"
import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { requireRole } from "@/lib/auth"

export default async function EditItemPage({ params }: PageProps<"/[lang]/admin/menu/[id]">) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ["ADMIN"])
  const [item, options, dict] = await Promise.all([getAdminItem(id), getEditorOptions(lang), getDictionary(lang)])
  if (!item) notFound()
  return (
    <main id="main-content">
      <ItemForm
        lang={lang}
        itemId={item.id}
        options={options}
        sourceLabel={dict.admin.menu.source[item.source]}
        initial={{
          slug: item.slug,
          categoryId: item.categoryId,
          price: String(item.price),
          imageUrl: item.imageUrl ?? "",
          sortOrder: String(item.sortOrder),
          isAvailable: item.isAvailable,
          isNew: item.isNew,
          isArchived: item.isArchived,
          groupIds: item.modifierGroups.map((g) => g.groupId),
          translations: draftFrom(item.translations),
        }}
      />
    </main>
  )
}
