import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { OfflineContent } from "@/components/pwa/offline-content"

export async function generateMetadata({ params }: PageProps<"/[lang]/offline">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: dict.pwa.offlineTitle, robots: { index: false } }
}

/** The page the service worker serves when a navigation cannot reach the network. */
export default async function OfflinePage({ params }: PageProps<"/[lang]/offline">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return <OfflineContent lang={lang} dict={dict} />
}
