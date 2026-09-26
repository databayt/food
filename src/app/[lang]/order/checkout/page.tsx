import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { CheckoutForm } from "@/components/order/checkout/form"
import { getMenu } from "@/components/order/menu/queries"
import { getRestaurant } from "@/components/restaurant/queries"
import { SiteHeader } from "@/components/template/site-header"

export async function generateMetadata({ params }: PageProps<"/[lang]/order/checkout">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: dict.checkout.title, robots: { index: false } }
}

export default async function CheckoutPage({ params }: PageProps<"/[lang]/order/checkout">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const [menu, r] = await Promise.all([getMenu(lang), getRestaurant()])
  return (
    <>
      <SiteHeader lang={lang} />
      <CheckoutForm
        lang={lang}
        menu={menu}
        settings={{
          isOpen: r.isOpen,
          pickupEnabled: r.pickupEnabled,
          deliveryEnabled: r.deliveryEnabled,
          deliveryFee: r.deliveryFee,
          cashEnabled: r.cashEnabled,
          momoEnabled: r.momoEnabled,
          momoCode: r.momoCode,
        }}
      />
    </>
  )
}
