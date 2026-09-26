import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminMenuContent } from "@/components/admin/menu/content"
import { getAdminItems } from "@/components/admin/menu/queries"
import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { requireRole } from "@/lib/auth"

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/menu">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).admin.menu.title }
}

export default async function AdminMenuPage({ params }: PageProps<"/[lang]/admin/menu">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ["ADMIN"])
  return <AdminMenuContent lang={lang} items={await getAdminItems(lang)} />
}
