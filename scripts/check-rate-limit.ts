/**
 * Exercise the Postgres rate-limit fallback against the real table (the
 * production path when Upstash is not configured). Dev database only.
 *
 *   tsx --conditions=react-server scripts/check-rate-limit.ts
 */
import "dotenv/config"

import { db } from "../src/lib/db"
import { pgRateLimit } from "../src/lib/rate-limit"

async function main() {
  const id = `check-${Date.now()}`
  const results: boolean[] = []
  for (let i = 0; i < 6; i++) results.push((await pgRateLimit("order-phone", id)).success)
  console.log("order-phone (limit 5):", results.join(" "))
  if (results.slice(0, 5).some((r) => !r) || results[5]) throw new Error("unexpected rate-limit results")
  await db.rateLimitCounter.deleteMany({ where: { key: { startsWith: `order-phone:${id}:` } } })
  console.log("✓ pgRateLimit works against rate_limit_counters")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
