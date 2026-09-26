import type { Locale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { getRestaurant } from "@/components/restaurant/queries"
import { SiteHeader } from "@/components/template/site-header"

import { WhatsAppFallback } from "../whatsapp-fallback"
import { CartBar } from "./cart-bar"
import { MenuBoard } from "./menu-board"
import { PrintedMenu } from "./printed-menu"
import { getMenu } from "./queries"
import { RecentOrders } from "./recent-orders"

/** /[lang]/order — the QR landing: SCAN → CHOOSE → ORDER. */
export async function OrderMenuContent({ lang }: { lang: Locale }) {
  const [dict, restaurant, menu] = await Promise.all([getDictionary(lang), getRestaurant(), getMenu(lang)])
  const canOrder = restaurant.isOpen

  return (
    <>
      <SiteHeader lang={lang} isOpen={restaurant.isOpen} openLabel={dict.common.open} closedLabel={dict.common.closed} />
      <main id="main-content" className="pb-32">
        <div className="mx-auto max-w-5xl px-4 pb-4 pt-6">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-4xl">{dict.order.heading}</h1>
          <p className="mt-1">{dict.order.subheading}</p>
          {!restaurant.isOpen && (
            <p role="status" className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm font-medium text-foreground">
              {dict.order.closedBanner}
            </p>
          )}
        </div>
        <div className="space-y-6 pb-2">
          <RecentOrders lang={lang} menu={menu} canOrder={canOrder} />
          <PrintedMenu images={restaurant.menuImages} />
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
