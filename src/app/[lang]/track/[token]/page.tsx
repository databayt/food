import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { interpolate } from "@/components/internationalization/interpolate"
import { WhatsAppFallback } from "@/components/order/whatsapp-fallback"
import { getRestaurant } from "@/components/restaurant/queries"
import { SiteHeader } from "@/components/template/site-header"
import { TrackContent } from "@/components/track/content"
import { getTrackedOrder } from "@/components/track/queries"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function TrackPage({ params, searchParams }: PageProps<"/[lang]/track/[token]">) {
  const { lang, token } = await params
  if (!isLocale(lang)) notFound()
  const [dict, order, restaurant, sp] = await Promise.all([
    getDictionary(lang),
    getTrackedOrder(token, lang),
    getRestaurant(),
    searchParams,
  ])

  if (!order) {
    return (
      <>
        <SiteHeader lang={lang} />
        <main id="main-content" className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold sm:text-2xl lg:text-2xl">{dict.track.notFound}</h1>
          <p className="mt-2">{dict.track.notFoundHint}</p>
          <Button asChild variant="black" className="mt-6 h-11 rounded-full px-6">
            <Link href={`/${lang}/order`}>{dict.common.backToMenu}</Link>
          </Button>
        </main>
      </>
    )
  }

  const helpMessage = interpolate(dict.track.title, { number: order.number })
  return (
    <>
      <SiteHeader lang={lang} />
      <TrackContent
        lang={lang}
        token={token}
        initial={order}
        isNew={sp.new === "1"}
        help={
          <WhatsAppFallback
            whatsappNumber={restaurant.whatsappNumber}
            phone={restaurant.phone}
            message={helpMessage}
            label={dict.common.orderOnWhatsApp}
            hint={dict.track.needHelp}
            callLabel={dict.common.call}
          />
        }
      />
    </>
  )
}
