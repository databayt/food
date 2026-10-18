import "server-only"

import { normalizeRwandaPhone } from "@/lib/order/phone"

/**
 * MTN MoMo Collection ("Request to Pay") settings, all from env. With no
 * keys the feature is off and checkout falls back to the manual merchant
 * code. Sandbox: https://sandbox.momodeveloper.mtn.com, target "sandbox",
 * currency EUR. Production Rwanda: target "mtnrwanda", currency RWF.
 */
export type MomoConfig = {
  baseUrl: string
  targetEnv: string
  subscriptionKey: string
  apiUser: string
  apiKey: string
  callbackUrl: string | null
  currency: string
}

const env = (name: string) => process.env[name]?.trim() || ""

export function getMomoConfig(): MomoConfig | null {
  const config = {
    baseUrl: env("MOMO_BASE_URL").replace(/\/+$/, ""),
    targetEnv: env("MOMO_TARGET_ENV"),
    subscriptionKey: env("MOMO_SUBSCRIPTION_KEY"),
    apiUser: env("MOMO_API_USER"),
    apiKey: env("MOMO_API_KEY"),
    callbackUrl: env("MOMO_CALLBACK_URL") || null,
    currency: env("MOMO_CURRENCY") || "RWF",
  }
  const required = [config.baseUrl, config.targetEnv, config.subscriptionKey, config.apiUser, config.apiKey]
  return required.every(Boolean) ? config : null
}

export function isMomoApiConfigured(): boolean {
  return getMomoConfig() !== null
}

const MTN_RWANDA = /^\+2507[89]\d{7}$/

/**
 * Payer number → E.164. Production takes MTN Rwanda only (078/079); the
 * sandbox also takes MTN's international test MSISDNs (e.g. 46733123450).
 */
export function toMomoPayer(raw: string, sandbox: boolean): string | null {
  const normalized = normalizeRwandaPhone(raw)
  if (normalized) return MTN_RWANDA.test(normalized) ? normalized : null
  if (!sandbox) return null
  const digits = raw.replace(/[\s\-().+]/g, "")
  return /^\d{8,15}$/.test(digits) ? `+${digits}` : null
}
