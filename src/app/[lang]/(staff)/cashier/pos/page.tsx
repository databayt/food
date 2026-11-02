import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PosContent } from "@/components/cashier/pos/content"
import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { getMenu } from "@/components/order/menu/queries"
import { getRestaurant } from "@/components/restaurant/queries"
import { requireRole } from "@/lib/auth"
import { isMomoApiConfigured } from "@/lib/momo/config"
import { ROUTE_ROLES } from "@/routes"

export async function generateMetadata({ params }: PageProps<"/[lang]/cashier/pos">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).pos.title }
}

/** Counter POS: ring up walk-ins and phone orders (cashier, admin). */
export default async function PosPage({ params }: PageProps<"/[lang]/cashier/pos">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ROUTE_ROLES.cashier)
  const [menu, r] = await Promise.all([getMenu(lang), getRestaurant()])
  return (
    <PosContent
      lang={lang}
      menu={menu}
      settings={{
        deliveryEnabled: r.deliveryEnabled,
        deliveryFee: r.deliveryFee,
        momo: r.momoEnabled && isMomoApiConfigured(),
        restaurant: { name: r.name, address: r.address, phone: r.phone },
      }}
    />
  )
}
