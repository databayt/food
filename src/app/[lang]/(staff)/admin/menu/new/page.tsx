import { notFound } from "next/navigation"

import { ItemForm } from "@/components/admin/menu/form"
import { getEditorOptions } from "@/components/admin/menu/queries"
import { emptyDraft } from "@/components/admin/translation-fields"
import { isLocale } from "@/components/internationalization/config"
import { requireRole } from "@/lib/auth"

export default async function NewItemPage({ params }: PageProps<"/[lang]/admin/menu/new">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ["ADMIN"])
  const options = await getEditorOptions(lang)
  return (
    <main id="main-content">
      <ItemForm
        lang={lang}
        itemId={null}
        options={options}
        initial={{
          slug: "",
          categoryId: options.categories[0]?.id ?? "",
          price: "",
          imageUrl: "",
          sortOrder: "0",
          isAvailable: true,
          isNew: false,
          isArchived: false,
          groupIds: [],
          translations: emptyDraft(),
        }}
      />
    </main>
  )
}
