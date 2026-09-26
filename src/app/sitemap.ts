import type { MetadataRoute } from "next"

import { i18n, localeConfig } from "@/components/internationalization/config"
import { SITE_URL } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  return i18n.locales.map((locale) => ({
    url: `${SITE_URL}/${locale}/order`,
    changeFrequency: "daily",
    priority: 1,
    alternates: {
      languages: Object.fromEntries(i18n.locales.map((l) => [localeConfig[l].intl, `${SITE_URL}/${l}/order`])),
    },
  }))
}
