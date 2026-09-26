import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { KitchenContent } from "@/components/kitchen/content"
import { getKitchenQueue } from "@/components/kitchen/queries"
import { requireRole } from "@/lib/auth"
import { ROUTE_ROLES } from "@/routes"

export async function generateMetadata({ params }: PageProps<"/[lang]/kitchen">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).kitchen.title }
}

export default async function KitchenPage({ params }: PageProps<"/[lang]/kitchen">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ROUTE_ROLES.kitchen)
  const orders = await getKitchenQueue(lang)
  return <KitchenContent lang={lang} initial={orders} />
}
