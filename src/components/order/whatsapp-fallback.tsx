import { Phone } from "lucide-react"

import { WhatsAppIcon } from "@/components/atom/icons"
import { formatLocalPhone } from "@/lib/order/phone"
import { whatsAppHref } from "@/lib/order/whatsapp"

/**
 * WhatsApp + phone fallback. Plain links — never a dependency of ordering.
 */
export function WhatsAppFallback({
  whatsappNumber,
  phone,
  message,
  label,
  hint,
  callLabel,
}: {
  whatsappNumber: string | null
  phone: string | null
  message?: string
  label: string
  hint?: string
  callLabel: string
}) {
  const href = whatsAppHref(whatsappNumber, message)
  if (!href && !phone) return null
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {hint && <p className="text-sm">{hint}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-whatsapp px-5 font-semibold text-white"
            data-testid="whatsapp-link"
          >
            <WhatsAppIcon size={20} />
            {label}
          </a>
        )}
        {phone && (
          <a href={`tel:${phone}`} className="inline-flex h-11 items-center gap-2 rounded-full border px-5 font-semibold">
            <Phone className="size-4" />
            <span className="sr-only">{callLabel}</span>
            <bdi dir="ltr">{formatLocalPhone(phone)}</bdi>
          </a>
        )}
      </div>
    </div>
  )
}
