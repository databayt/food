"use server"

import { toLocale } from "@/components/internationalization/config"
import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { assertRateLimit, getClientId, RateLimitError } from "@/lib/rate-limit"

import { getTrackedOrder } from "./queries"
import type { TrackedOrder } from "./types"

/** Polled by the tracking page (visibility-aware, every 10 s). */
export async function getOrderStatus(token: string, locale: string): Promise<ActionResponse<TrackedOrder>> {
  try {
    await assertRateLimit("track", await getClientId())
  } catch (error) {
    if (error instanceof RateLimitError) return fail("RATE_LIMITED")
    throw error
  }
  if (typeof token !== "string") return fail("NOT_FOUND")
  const order = await getTrackedOrder(token, toLocale(locale))
  return order ? ok(order) : fail("NOT_FOUND")
}
