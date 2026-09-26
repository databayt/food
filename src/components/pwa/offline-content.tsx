"use client"

import { WifiOff } from "lucide-react"

import type { Locale } from "@/components/internationalization/config"
import type { Dictionary } from "@/components/internationalization/dictionaries"
import { Button } from "@/components/ui/button"

/**
 * Shown by the service worker at the URL the customer tried to open, so
 * "Try again" is a plain reload of that URL. No server data: the worker
 * precaches this page once at install. Links are full navigations — a
 * client-side one would ask the network for an RSC payload first.
 */
export function OfflineContent({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <main id="main-content" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
        <WifiOff className="size-7" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold lg:text-3xl">{dict.pwa.offlineTitle}</h1>
      <p className="mt-2 text-muted-foreground">{dict.pwa.offlineBody}</p>
      <div className="mt-6 flex gap-2">
        <Button variant="black" className="h-11 rounded-full px-6" onClick={() => window.location.reload()}>
          {dict.common.retry}
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-full px-6">
          <a href={`/${lang}/order`}>{dict.common.backToMenu}</a>
        </Button>
      </div>
    </main>
  )
}
