import type { Locale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { getRestaurant } from "@/components/restaurant/queries"
import { SiteHeader } from "@/components/template/site-header"

import { WhatsAppFallback } from "../whatsapp-fallback"
import { MenuBanner } from "./banner"
import { CartBar } from "./cart-bar"
import { MenuBoard } from "./menu-board"
import { getMenu } from "./queries"
import { RecentOrders } from "./recent-orders"

/** /[lang]/order — the QR landing: SCAN → CHOOSE → ORDER. */
export async function OrderMenuContent({ lang }: { lang: Locale }) {
  const [dict, restaurant, menu] = await Promise.all([getDictionary(lang), getRestaurant(), getMenu(lang)])
  const canOrder = restaurant.isOpen

  return (
    <>
      <SiteHeader lang={lang} logoUrl={restaurant.logoUrl} isOpen={restaurant.isOpen} openLabel={dict.common.open} closedLabel={dict.common.closed} />
      <main id="main-content" className="min-h-dvh bg-muted pb-32">
        <MenuBanner dict={dict} isOpen={restaurant.isOpen} whatsappNumber={restaurant.whatsappNumber} />
        <div className="pb-2 pt-6">
          <RecentOrders lang={lang} menu={menu} canOrder={canOrder} />
        </div>
        <MenuBoard menu={menu} canOrder={canOrder} />
        <footer className="mx-auto max-w-5xl border-t px-4 py-8">
          <WhatsAppFallback
            whatsappNumber={restaurant.whatsappNumber}
            phone={restaurant.phone}
            label={dict.common.orderOnWhatsApp}
            hint={dict.common.whatsAppFallback}
            callLabel={dict.common.call}
          />
          <p className="mt-6 text-center text-xs">{dict.common.tagline}</p>
        </footer>
      </main>
      <CartBar lang={lang} menu={menu} />
    </>
  )
}
