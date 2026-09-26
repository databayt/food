"use client"

import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { cn } from "@/lib/utils"

/** "12 min ago", turning amber after 15 min and red after 30. */
export function Elapsed({ since, now, className }: { since: string; now: number; className?: string }) {
  const dict = useDictionary()
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000))
  return (
    <span
      className={cn(
        "tabular-nums",
        minutes >= 30 ? "font-semibold text-destructive" : minutes >= 15 ? "font-semibold text-amber-600" : "text-muted-foreground",
        className
      )}
    >
      {minutes < 1 ? (dict?.staff?.justNow ?? "Just now") : interpolate(dict?.staff?.minutesAgo ?? "{minutes} min ago", { minutes })}
    </span>
  )
}

export function LiveBadge({ offline }: { offline: boolean }) {
  const dict = useDictionary()
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        offline ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"
      )}
      data-testid="live-badge"
    >
      <span className={cn("size-1.5 rounded-full", offline ? "bg-amber-500" : "animate-pulse bg-emerald-500")} />
      {offline ? (dict?.staff?.reconnecting ?? "Reconnecting…") : (dict?.staff?.live ?? "Live")}
    </span>
  )
}
