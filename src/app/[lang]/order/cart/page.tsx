import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { CartContent } from "@/components/order/cart/content"
import { getMenu } from "@/components/order/menu/queries"
import { getRestaurant } from "@/components/restaurant/queries"
import { SiteHeader } from "@/components/template/site-header"

export async function generateMetadata({ params }: PageProps<"/[lang]/order/cart">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: dict.cart.title, robots: { index: false } }
}

export default async function CartPage({ params }: PageProps<"/[lang]/order/cart">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const [menu, restaurant] = await Promise.all([getMenu(lang), getRestaurant()])
  return (
    <>
      <SiteHeader lang={lang} logoUrl={restaurant.logoUrl} />
      <CartContent lang={lang} menu={menu} canOrder={restaurant.isOpen} />
    </>
  )
}
