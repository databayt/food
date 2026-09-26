import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { OrderMenuContent } from "@/components/order/menu/content"

export async function generateMetadata({ params }: PageProps<"/[lang]/order">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: dict.order.title }
}

export default async function OrderPage({ params }: PageProps<"/[lang]/order">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return <OrderMenuContent lang={lang} />
}
