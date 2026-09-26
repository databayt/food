import "server-only"

import { revalidatePath } from "next/cache"

import { getStaffSession, type StaffSession } from "@/lib/auth"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"

/** Admin action preamble: session with ADMIN role + per-user rate limit. */
export async function adminGuard(): Promise<{ session: StaffSession } | { error: "FORBIDDEN" | "RATE_LIMITED" }> {
  const session = await getStaffSession(["ADMIN"])
  if (!session) return { error: "FORBIDDEN" }
  try {
    await assertRateLimit("mutation", session.user.id)
  } catch (error) {
    if (error instanceof RateLimitError) return { error: "RATE_LIMITED" }
    throw error
  }
  return { session }
}

/** Menu and settings feed every customer page — refresh the whole tree. */
export function revalidateAll() {
  revalidatePath("/", "layout")
}
