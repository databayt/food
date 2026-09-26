import Image from "next/image"

import { WhatsAppIcon } from "@/components/atom/icons"
import type { Dictionary } from "@/components/internationalization/dictionaries"
import { whatsAppHref } from "@/lib/order/whatsapp"
import { cn } from "@/lib/utils"

/**
 * The menu's opening banner — the balqalam live banner (hogwarts
 * `live/landing/status-hero.tsx`): a brand-green ground at a 36px radius,
 * a light headline with its phrase carried by weight, and pill actions. The
 * art is the restaurant logo sitting directly on the ground.
 *
 * Ink is pinned to `brand-ink` (near-black) — white on this green is ~2.5:1.
 */
export function MenuBanner({
  dict,
  isOpen,
  whatsappNumber,
}: {
  dict: Dictionary
  isOpen: boolean
  whatsappNumber: string | null
}) {
  const t = dict.order.banner
  const [before, after] = t.title.split("{mark}")
  const wa = whatsAppHref(whatsappNumber)

  return (
    <section className="mx-auto max-w-5xl px-4 pt-4">
      <div className="relative isolate flex min-h-[220px] flex-col justify-between gap-6 overflow-hidden rounded-[28px] bg-brand px-6 py-8 text-brand-ink sm:rounded-[36px] sm:px-12 sm:py-10 lg:min-h-[259px] lg:justify-center">
        <Image
          src="/logo.png"
          alt=""
          width={168}
          height={168}
          priority
          aria-hidden="true"
          className="pointer-events-none absolute -end-6 -bottom-8 size-[112px] rotate-[-8deg] object-contain opacity-95 sm:end-10 sm:bottom-auto sm:size-[168px] sm:rotate-0"
        />

        <div className="relative min-w-0 max-w-[13ch] sm:max-w-[420px]">
          <h1 className="text-3xl font-light leading-[1.3] text-balance text-brand-ink sm:text-4xl lg:text-[38px]">
            {after === undefined ? (
              t.title
            ) : (
              <>
                {before}
                <strong className="font-bold">{t.mark}</strong>
                {after}
              </>
            )}
          </h1>
          {!isOpen && <p className="mt-3 max-w-[32ch] text-base text-brand-ink/75">{dict.order.closedBanner}</p>}
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          <a href="#menu" className={pill("default")} data-testid="banner-cta">
            {isOpen ? t.cta : t.browse}
          </a>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={pill("ghost")}>
              <WhatsAppIcon size={16} />
              {dict.common.orderOnWhatsApp}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

function pill(variant: "default" | "ghost") {
  return cn(
    "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-medium transition-colors",
    "outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40",
    variant === "default"
      ? "bg-white text-brand-ink hover:bg-white/90"
      : "text-brand-ink/80 hover:bg-brand-ink/10 hover:text-brand-ink"
  )
}
