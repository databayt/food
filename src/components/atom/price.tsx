import { formatRwf } from "@/lib/order/money"
import { cn } from "@/lib/utils"

/**
 * An RWF amount — "4,000 RWF" with Latin digits. <bdi dir="ltr"> keeps the
 * number and currency in reading order inside Arabic (RTL) text.
 */
export function Price({ amount, className }: { amount: number; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums whitespace-nowrap", className)}>
      {formatRwf(amount)}
    </bdi>
  )
}
