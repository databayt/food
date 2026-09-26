import { notFound } from "next/navigation"
import QRCode from "qrcode"

import { QrContent } from "@/components/admin/qr/content"
import { i18n, isLocale, type Locale } from "@/components/internationalization/config"
import { requireRole } from "@/lib/auth"
import { SITE_URL } from "@/lib/site"

export default async function QrPage({ params }: PageProps<"/[lang]/admin/qr">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ["ADMIN"])
  const entries = await Promise.all(
    i18n.locales.map(async (l) => {
      const url = `${SITE_URL}/${l}/order`
      const dataUrl = await QRCode.toDataURL(url, { width: 560, margin: 2, errorCorrectionLevel: "M" })
      return [l, { url, dataUrl }] as const
    })
  )
  return <QrContent codes={Object.fromEntries(entries) as Record<Locale, { url: string; dataUrl: string }>} />
}
