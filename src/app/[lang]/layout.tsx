import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import localFont from "next/font/local"
import { notFound } from "next/navigation"
import { Toaster } from "sonner"

import { i18n, isLocale, localeConfig } from "@/components/internationalization/config"
import { DictionaryProvider } from "@/components/internationalization/dictionary-context"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { ServiceWorkerProvider } from "@/components/pwa/service-worker-provider"
import { BRAND_NAME } from "@/lib/site"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
}

// display:'optional' (mkan): on slow connections keep the size-adjusted
// fallback instead of a late swap that re-sets LCP and shifts layout.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "optional" })

// Thmanyah serif-text — the Arabic UI face (mkan/hogwarts). Fetched by
// scripts/fetch-thmanyah.mjs; git-ignored because the license forbids
// redistribution.
const thmanyahText = localFont({
  src: [
    { path: "../../fonts/thmanyah/thmanyah-serif-text-400.woff2", weight: "400" },
    { path: "../../fonts/thmanyah/thmanyah-serif-text-500.woff2", weight: "500" },
    { path: "../../fonts/thmanyah/thmanyah-serif-text-700.woff2", weight: "700" },
    { path: "../../fonts/thmanyah/thmanyah-serif-text-900.woff2", weight: "900" },
  ],
  variable: "--font-thmanyah-text",
  display: "optional",
})

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return {
    title: { default: dict.meta.title, template: `%s · ${BRAND_NAME}` },
    description: dict.meta.description,
    alternates: {
      canonical: `/${lang}/order`,
      languages: Object.fromEntries([
        ...i18n.locales.map((l) => [localeConfig[l].intl, `/${l}/order`]),
        ["x-default", `/${i18n.defaultLocale}/order`],
      ]),
    },
    openGraph: { title: dict.meta.title, description: dict.meta.description, locale: localeConfig[lang].og, siteName: BRAND_NAME },
  }
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const config = localeConfig[lang]
  const isRTL = config.dir === "rtl"
  const dict = await getDictionary(lang)

  return (
    <html lang={lang} dir={config.dir} className={`${inter.variable} ${thmanyahText.variable}`} suppressHydrationWarning>
      <body className={`${isRTL ? thmanyahText.className : inter.className} min-h-dvh antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:border focus:bg-background focus:p-4"
        >
          {dict.common.skipToContent}
        </a>
        <DictionaryProvider lang={lang}>
          {children}
          <Toaster richColors position="top-center" dir={config.dir} />
          <ServiceWorkerProvider />
        </DictionaryProvider>
      </body>
    </html>
  )
}

export function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}
