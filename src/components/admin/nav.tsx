"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { Locale } from "@/components/internationalization/config"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { cn } from "@/lib/utils"

const ITEMS = ["orders", "menu", "categories", "modifiers", "settings", "staff", "qr"] as const

/** Admin sub-navigation: start-side list on desktop, scrolling chips on phones. */
export function AdminNav({ lang }: { lang: Locale }) {
  const dict = useDictionary()
  const pathname = usePathname() ?? ""
  return (
    <nav aria-label={dict?.admin?.title ?? "Admin"} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <ul className="flex gap-2 md:flex-col md:gap-1">
        {ITEMS.map((key) => {
          const href = `/${lang}/admin/${key}`
          const active = pathname.startsWith(href)
          return (
            <li key={key} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-full px-4 py-2 text-sm font-medium md:rounded-lg",
                  active ? "bg-foreground text-background" : "bg-background hover:bg-muted md:bg-transparent"
                )}
              >
                {(dict?.admin?.nav as Record<string, string> | undefined)?.[key] ?? key}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
