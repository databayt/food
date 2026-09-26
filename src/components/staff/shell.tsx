"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"
import type { UserRole } from "@prisma/client"

import { BrandMark } from "@/components/atom/brand-mark"
import { ChefGlyph, ReceiptGlyph, SettingsGlyph } from "@/components/atom/icons"
import { logout } from "@/components/auth/login/actions"
import type { Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Button } from "@/components/ui/button"
import { BRAND_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"

import { navFor, type StaffNavKey } from "./nav"

const ICONS: Record<StaffNavKey, (p: { size?: number }) => React.ReactElement> = {
  queue: ReceiptGlyph,
  kitchen: ChefGlyph,
  admin: SettingsGlyph,
}

/**
 * Staff shell — mkan's hosting pattern: a slim top bar everywhere, plus a
 * fixed bottom tab bar on phones (hosting-bottom-nav) with safe-area padding.
 */
export function StaffShell({
  lang,
  role,
  userName,
  logoUrl,
  children,
}: {
  lang: Locale
  role: UserRole
  userName: string
  logoUrl?: string | null
  children: React.ReactNode
}) {
  const dict = useDictionary()
  const pathname = usePathname() ?? ""
  const items = navFor(role)
  const isActive = (href: string) => pathname.startsWith(`/${lang}${href}`)

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="sticky top-0 z-40 h-14 border-b bg-background">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-4">
          <Link href={`/${lang}${items[0]?.href ?? "/cashier"}`} className="flex items-center gap-2">
            <BrandMark logoUrl={logoUrl} />
            <span className="hidden font-extrabold sm:inline">{BRAND_NAME}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label={dict?.meta?.staffTitle ?? "Staff"}>
            {items.map(({ key, href }) => (
              <Link
                key={key}
                href={`/${lang}${href}`}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive(href) ? "bg-foreground text-background" : "hover:bg-muted"
                )}
              >
                {dict?.staff?.nav?.[key] ?? key}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <span className="hidden text-sm text-muted-foreground lg:inline">
              {userName} · {dict?.enums?.userRole?.[role] ?? role}
            </span>
            <LanguageSwitcher />
            <form action={logout.bind(null, lang)}>
              <Button type="submit" variant="ghost" size="icon" className="rounded-full px-0" aria-label={dict?.common?.signOut ?? "Sign out"}>
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="pb-24 md:pb-0">{children}</div>

      {items.length > 1 && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label={dict?.meta?.staffTitle ?? "Staff"}
        >
          <ul className="flex">
            {items.map(({ key, href }) => {
              const Icon = ICONS[key]
              const active = isActive(href)
              return (
                <li key={key} className="flex-1">
                  <Link
                    href={`/${lang}${href}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1 pb-1.5 pt-2 text-[11px]",
                      active ? "font-semibold text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon size={24} />
                    {dict?.staff?.nav?.[key] ?? key}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}
