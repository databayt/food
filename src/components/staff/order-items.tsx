import type { QueueItem } from "@/components/cashier/types"
import { cn } from "@/lib/utils"

/** Item list shared by cashier cards and the kitchen display. */
export function OrderItems({ items, large = false }: { items: QueueItem[]; large?: boolean }) {
  return (
    <ul className={cn("space-y-2", large && "space-y-3")}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-2">
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-md bg-foreground font-bold tabular-nums text-background",
              large ? "h-8 min-w-8 px-1.5 text-lg" : "h-6 min-w-6 px-1 text-sm"
            )}
          >
            {item.quantity}
          </span>
          <div className="min-w-0">
            <p dir="auto" className={cn("text-start font-semibold leading-tight text-foreground", large && "text-lg")}>
              {item.name}
            </p>
            {item.modifiers.length > 0 && (
              <p className={cn("text-muted-foreground", large ? "text-base" : "text-sm")}>+ {item.modifiers.join(", ")}</p>
            )}
            {item.note && (
              <p className={cn("mt-0.5 rounded bg-amber-50 px-1.5 font-medium text-amber-900", large ? "text-base" : "text-sm")}>
                {item.note}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
