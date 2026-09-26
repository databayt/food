/** Canonical origin for metadata and absolute links (QR codes, WhatsApp). */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")

export const BRAND_NAME = "Charles Burgers"

/** All staff- and customer-facing times render in the restaurant's timezone. */
export const TIME_ZONE = "Africa/Kigali"
