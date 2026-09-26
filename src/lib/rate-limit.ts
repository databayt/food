import "server-only"

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { headers } from "next/headers"

/**
 * Rate limiting (ported from mkan `src/lib/rate-limit.ts`).
 *
 * Upstash sliding windows when configured; otherwise a fixed-window counter
 * in Postgres (`rate_limit_counters`) so production never fails open just
 * because Redis is absent. DB errors DO fail open — rate limiting must never
 * be the thing that takes ordering down. Skipped in development.
 */

const TIER_CONFIG = {
  /**
   * Guest order creation — per client IP. Loose on purpose: Rwandan mobile
   * traffic is heavily carrier-NATed, so one IP can be a whole neighbourhood.
   */
  order: { limit: 60, windowMs: 10 * 60_000, window: "10 m" },
  /** Guest order creation — per normalized phone number (the real identity). */
  "order-phone": { limit: 5, windowMs: 10 * 60_000, window: "10 m" },
  /** Guest order-status polling — per client IP. */
  track: { limit: 120, windowMs: 60_000, window: "1 m" },
  /** Staff login attempts — per IP. */
  auth: { limit: 5, windowMs: 10 * 60_000, window: "10 m" },
  /** Staff mutations — per user. */
  mutation: { limit: 60, windowMs: 60_000, window: "1 m" },
  /** Image uploads — per user. */
  upload: { limit: 10, windowMs: 60_000, window: "1 m" },
} as const

export type RateLimitTier = keyof typeof TIER_CONFIG

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null

const limiters = new Map<RateLimitTier, Ratelimit>()
function upstashLimiter(tier: RateLimitTier): Ratelimit | null {
  if (!redis) return null
  let limiter = limiters.get(tier)
  if (!limiter) {
    const { limit, window } = TIER_CONFIG[tier]
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `@upstash/ratelimit/cb/${tier}`,
    })
    limiters.set(tier, limiter)
  }
  return limiter
}

export async function pgRateLimit(tier: RateLimitTier, identifier: string) {
  const { limit, windowMs } = TIER_CONFIG[tier]
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs
  const reset = windowStart + windowMs
  try {
    const { db } = await import("@/lib/db")
    const key = `${tier}:${identifier}:${windowStart}`
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "rate_limit_counters" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${new Date(reset)})
      ON CONFLICT ("key") DO UPDATE SET "count" = "rate_limit_counters"."count" + 1
      RETURNING "count"`
    const count = Number(rows[0]?.count ?? 1)
    if (Math.random() < 0.02) {
      db.$executeRaw`DELETE FROM "rate_limit_counters" WHERE "expiresAt" < now()`.catch(() => {})
    }
    return { success: count <= limit, reset }
  } catch {
    return { success: true, reset }
  }
}

/** Client IP for server actions / route handlers. */
export async function getClientId(): Promise<string> {
  const h = await headers()
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  )
}

export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED" as const
  constructor(public retryAfter: number) {
    super("RATE_LIMITED")
    this.name = "RateLimitError"
  }
}

/** Throws RateLimitError when `(tier, identifier)` is over budget. */
export async function assertRateLimit(tier: RateLimitTier, identifier: string): Promise<void> {
  if (process.env.NODE_ENV === "development" || process.env.DISABLE_RATE_LIMIT === "1") return

  const limiter = upstashLimiter(tier)
  const res = limiter ? await limiter.limit(identifier) : await pgRateLimit(tier, identifier)
  if (!res.success) {
    throw new RateLimitError(Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)))
  }
}
