// OpenNext adapter config for Cloudflare Workers.
//
// Public pages use time-based ISR (`revalidate = 300`) and admin writes call revalidatePath,
// so the cache is real, and every piece of it runs on the Workers Paid plan the account already has:
//   incremental cache → KV (NEXT_INC_CACHE_KV)
//   tag cache         → Durable Object, sharded (NEXT_TAG_CACHE_DO_SHARDED) — revalidatePath/Tag
//   queue             → in-memory (fine at this traffic; move to the DO queue if it grows)
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache"
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue"
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache"

const config = {
  ...defineCloudflareConfig({
    incrementalCache: kvIncrementalCache,
    tagCache: doShardedTagCache({ baseShardSize: 4 }),
    queue: memoryQueue,
  }),
  // Webpack, not Turbopack: Turbopack wraps Prisma 7's query-compiler .wasm in a Node loader that
  // reads it off disk, and workerd has no filesystem. (Same reasoning as databayt/co.)
  buildCommand: "next build --webpack && node scripts/cf-trace-otel.mjs",
}

export default config
