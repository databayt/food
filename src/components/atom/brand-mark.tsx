import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * The restaurant's logo: the Settings logo URL when set (plain <img>, it can
 * be any https host), otherwise the bundled /logo.png.
 */
export function BrandMark({ logoUrl, className }: { logoUrl?: string | null; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary owner-supplied host
    return <img src={logoUrl} alt="" width={32} height={32} className={cn("size-8 shrink-0 object-contain", className)} />
  }
  return <Image src="/logo.png" alt="" width={32} height={32} priority className={cn("size-8 shrink-0 object-contain", className)} />
}
