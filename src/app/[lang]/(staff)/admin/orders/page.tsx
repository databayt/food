import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { OrdersContent } from "@/components/admin/orders/content"
import { parseFilters, searchOrders } from "@/components/admin/orders/queries"
import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { requireRole } from "@/lib/auth"

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/orders">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).admin.orders.title }
}

export default async function AdminOrdersPage({ params, searchParams }: PageProps<"/[lang]/admin/orders">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ["ADMIN"])
  const filters = parseFilters(await searchParams)
  const [dict, result] = await Promise.all([getDictionary(lang), searchOrders(filters)])
  return <OrdersContent lang={lang} dict={dict} filters={filters} result={result} />
}
