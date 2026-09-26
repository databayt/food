/**
 * Rwanda mobile numbers. Accepts local (07xxxxxxxx) and international
 * (+2507xxxxxxxx / 2507xxxxxxxx) forms, with spaces or dashes; stores E.164.
 * Mobile prefixes: 072/073 (Airtel), 078/079 (MTN).
 */
const RWANDA_MOBILE = /^(?:\+?250|0)(7[2389]\d{7})$/

export function normalizeRwandaPhone(raw: string): string | null {
  const compact = raw.replace(/[\s\-().]/g, "")
  const match = compact.match(RWANDA_MOBILE)
  return match ? `+250${match[1]}` : null
}

/** "+250794000095" → "250794000095" for wa.me links. */
export function toWhatsAppDigits(e164OrLocal: string): string | null {
  const normalized = normalizeRwandaPhone(e164OrLocal)
  return normalized ? normalized.slice(1) : null
}

/** "+250794000095" → "079 400 0095" for display. */
export function formatLocalPhone(e164: string): string {
  const normalized = normalizeRwandaPhone(e164)
  if (!normalized) return e164
  const local = `0${normalized.slice(4)}`
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}
