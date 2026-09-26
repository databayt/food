"use client"

import { useState } from "react"
import { Download, Printer } from "lucide-react"

import { i18n, localeConfig, type Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Button } from "@/components/ui/button"
import { BRAND_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"

/** Printable menu QR — one per locale, generated server-side with `qrcode`. */
export function QrContent({ codes }: { codes: Record<Locale, { url: string; dataUrl: string }> }) {
  const dict = useDictionary()
  const t = dict?.admin?.qr
  const [locale, setLocale] = useState<Locale>(i18n.defaultLocale)
  const code = codes[locale]

  return (
    <main id="main-content" className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-2xl font-extrabold sm:text-2xl lg:text-3xl">{t?.title}</h1>
        <p className="mt-1">{t?.hint}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t?.language}>
          {i18n.locales.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={l === locale}
              onClick={() => setLocale(l)}
              className={cn("rounded-full border px-4 py-1.5 text-sm", l === locale ? "border-foreground bg-foreground text-background" : "bg-background")}
            >
              {localeConfig[l].nativeName}
            </button>
          ))}
        </div>
      </div>

      <section className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-3xl border bg-background p-8 text-center print:border-0">
        <p className="text-2xl font-black">{BRAND_NAME}</p>
        <p className="text-lg font-semibold text-foreground" lang={locale}>
          {t?.scan}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimize */}
        <img src={code.dataUrl} alt={code.url} width={280} height={280} className="size-70" />
        <p className="break-all text-xs" dir="ltr">
          {code.url}
        </p>
      </section>

      <div className="flex justify-center gap-2 print:hidden">
        <Button variant="black" className="rounded-full" onClick={() => window.print()}>
          <Printer />
          {t?.print}
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <a href={code.dataUrl} download={`charles-burgers-menu-${locale}.png`}>
            <Download />
            {t?.download}
          </a>
        </Button>
      </div>
    </main>
  )
}
