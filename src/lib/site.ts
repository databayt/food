/** Canonical origin for metadata and absolute links (QR codes, WhatsApp). */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")

export const BRAND_NAME = "Charles Burgers"

/** All staff- and customer-facing times render in the restaurant's timezone. */
export const TIME_ZONE = "Africa/Kigali"

/** Start of "today" in Kigali (UTC+2, no DST) as a UTC Date. */
export function startOfTodayKigali(now: Date = new Date()): Date {
  const offsetMs = 2 * 60 * 60 * 1000
  const local = new Date(now.getTime() + offsetMs)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - offsetMs)
}
