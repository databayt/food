import { notFound } from "next/navigation"

import { OrderDetail } from "@/components/admin/orders/detail"
import { getOrderDetail } from "@/components/admin/orders/queries"
import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { requireRole } from "@/lib/auth"

export default async function AdminOrderPage({ params }: PageProps<"/[lang]/admin/orders/[id]">) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ["ADMIN"])
  const [dict, order] = await Promise.all([getDictionary(lang), getOrderDetail(id, lang)])
  if (!order) notFound()
  return <OrderDetail lang={lang} dict={dict} order={order} />
}
