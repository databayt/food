import { cn } from "@/lib/utils"

/**
 * The restaurant's logo when Admin → Settings has one, else the "CB"
 * monogram. A plain <img>: the logo URL can be any https host, so it is not
 * routed through next/image's remotePatterns.
 */
export function BrandMark({ logoUrl, className }: { logoUrl?: string | null; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary owner-supplied host
    return <img src={logoUrl} alt="" width={32} height={32} className={cn("size-8 shrink-0 rounded-full object-cover", className)} />
  }
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground", className)}>
      {/* i18n-exempt — brand monogram */}
      CB
    </span>
  )
}
