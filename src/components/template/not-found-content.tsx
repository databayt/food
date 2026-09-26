"use client"

import Link from "next/link"

import { BurgerGlyph } from "@/components/atom/icons"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { useLocale } from "@/components/internationalization/use-locale"
import { Button } from "@/components/ui/button"

export function NotFoundContent() {
  const dict = useDictionary()
  const { locale } = useLocale()
  return (
    <main id="main-content" className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
        <BurgerGlyph size={32} />
      </div>
      <h1 className="text-2xl font-bold sm:text-2xl lg:text-3xl">{dict?.common?.notFoundTitle ?? "Page not found"}</h1>
      <p className="mt-2">{dict?.common?.notFoundBody}</p>
      <Button asChild variant="black" className="mt-6 h-11 rounded-full px-6">
        <Link href={`/${locale}/order`}>{dict?.common?.backToMenu ?? "Back to menu"}</Link>
      </Button>
    </main>
  )
}

export function ErrorContent({ reset }: { reset: () => void }) {
  const dict = useDictionary()
  const { locale } = useLocale()
  return (
    <main id="main-content" className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold sm:text-2xl lg:text-3xl">{dict?.common?.errorTitle ?? "Something went wrong"}</h1>
      <p className="mt-2">{dict?.common?.errorBody}</p>
      <div className="mt-6 flex gap-2">
        <Button variant="black" className="h-11 rounded-full px-6" onClick={reset}>
          {dict?.common?.retry ?? "Try again"}
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-full px-6">
          <Link href={`/${locale}/order`}>{dict?.common?.backToMenu ?? "Back to menu"}</Link>
        </Button>
      </div>
    </main>
  )
}
