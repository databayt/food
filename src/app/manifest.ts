import type { MetadataRoute } from "next"
import { cookies } from "next/headers"

import { i18n, localeConfig, toLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { BRAND_NAME } from "@/lib/site"

/**
 * `/manifest.webmanifest` (hogwarts pattern, single restaurant).
 *
 * The proxy never sees this request (its matcher skips dotted paths), so the
 * locale comes from the NEXT_LOCALE cookie the proxy writes on page visits.
 * `start_url` names the locale explicitly: the installed app opens straight on
 * the menu instead of bouncing through the "/" redirect.
 *
 * Install criteria (Chrome): explicit 192 and 512 PNG icons — `sizes: "any"`
 * does not count — a same-origin start_url, and `display: standalone`.
 * Icons come from scripts/gen-pwa-icons.mjs.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const lang = toLocale((await cookies()).get("NEXT_LOCALE")?.value ?? i18n.defaultLocale)
  const dict = await getDictionary(lang)

  return {
    id: "/",
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: dict.meta.description,
    lang: localeConfig[lang].intl,
    dir: localeConfig[lang].dir,
    start_url: `/${lang}/order`,
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["food", "shopping"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }
}
