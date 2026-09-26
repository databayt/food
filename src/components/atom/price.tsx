import { Fragment } from "react"

import { cn } from "@/lib/utils"

const grouping = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

/**
 * An RWF amount: Latin digits then the R₣ sign (public/rwf.png, masked to
 * currentColor) — "4,000 R₣", as on the Figma menu sheet. <bdi dir="ltr">
 * keeps that order inside Arabic. Screen readers (and text search) get
 * "4,000 RWF".
 */
export function Price({ amount, className }: { amount: number; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("inline-flex items-baseline gap-[0.25em] tabular-nums whitespace-nowrap", className)}>
      <span>{grouping.format(amount)}</span>
      <span className="rwf-sign self-center" aria-hidden="true" />
      {/* i18n-exempt — ISO currency code for assistive tech */}
      <span className="sr-only"> RWF</span>
    </bdi>
  )
}

/** Render a dictionary template with a {price} slot as text + <Price />. */
export function Priced({ template, amount, className }: { template: string; amount: number; className?: string }) {
  const parts = template.split("{price}")
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <Price amount={amount} className={className} />}
        </Fragment>
      ))}
    </>
  )
}
