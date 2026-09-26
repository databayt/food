import Link from "next/link"

import { BrandMark } from "@/components/atom/brand-mark"
import type { Locale } from "@/components/internationalization/config"
import { LanguageSwitcher } from "@/components/language-switcher"
import { BRAND_NAME } from "@/lib/site"

/**
 * Customer header (mkan template/header, simplified for one restaurant):
 * logo + wordmark and the language switcher, on no background of its own —
 * it sits on whatever ground the page has. Fixed height so switching
 * language never shifts the layout.
 */
export function SiteHeader({ lang, logoUrl }: { lang: Locale; logoUrl?: string | null }) {
  return (
    <header className="h-14">
      <div className="mx-auto flex h-full max-w-5xl items-center gap-3 px-4">
        <Link href={`/${lang}/order`} className="flex min-w-0 items-center gap-2" aria-label={BRAND_NAME}>
          <BrandMark logoUrl={logoUrl} />
          <span className="truncate text-base font-extrabold tracking-tight">{BRAND_NAME}</span>
        </Link>
        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  )
}
