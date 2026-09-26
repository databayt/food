import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CashierContent } from "@/components/cashier/content"
import { getCashierQueue } from "@/components/cashier/queries"
import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { requireRole } from "@/lib/auth"
import { ROUTE_ROLES } from "@/routes"

export async function generateMetadata({ params }: PageProps<"/[lang]/cashier">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).cashier.title }
}

export default async function CashierPage({ params }: PageProps<"/[lang]/cashier">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ROUTE_ROLES.cashier)
  const orders = await getCashierQueue(lang)
  return <CashierContent lang={lang} initial={orders} />
}
