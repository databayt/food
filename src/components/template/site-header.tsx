import Link from "next/link"

import { BrandMark } from "@/components/atom/brand-mark"
import { LanguageSwitcher } from "@/components/language-switcher"
import type { Locale } from "@/components/internationalization/config"
import { BRAND_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"

/**
 * Customer header (mkan template/header, simplified for a single restaurant):
 * wordmark, open/closed state, language switcher. Fixed height so switching
 * language never shifts the layout.
 */
export function SiteHeader({
  lang,
  isOpen,
  openLabel,
  closedLabel,
  logoUrl,
  children,
}: {
  lang: Locale
  logoUrl?: string | null
  isOpen?: boolean
  openLabel?: string
  closedLabel?: string
  children?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-full max-w-5xl items-center gap-3 px-4">
        <Link href={`/${lang}/order`} className="flex min-w-0 items-center gap-2" aria-label={BRAND_NAME}>
          <BrandMark logoUrl={logoUrl} />
          <span className="truncate text-base font-extrabold tracking-tight">{BRAND_NAME}</span>
        </Link>
        {isOpen !== undefined && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              isOpen ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
            )}
          >
            <span className={cn("size-1.5 rounded-full", isOpen ? "bg-emerald-500" : "bg-muted-foreground")} />
            {isOpen ? openLabel : closedLabel}
          </span>
        )}
        <div className="ms-auto flex items-center gap-1">
          {children}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  )
}
