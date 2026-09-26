import { toWhatsAppDigits } from "./phone"

/** wa.me deep link with a prefilled message. Returns null for a bad number. */
export function whatsAppHref(number: string | null | undefined, text?: string): string | null {
  if (!number) return null
  const digits = toWhatsAppDigits(number)
  if (!digits) return null
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}
