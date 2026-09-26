import { randomBytes } from "node:crypto"

/** 128-bit random, URL-safe tracking token — order numbers can't be walked. */
export function generateTrackingToken(): string {
  return randomBytes(16).toString("base64url")
}

export const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/
