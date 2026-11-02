import "dotenv/config"

import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaPg } from "@prisma/adapter-pg"
import ws from "ws"

import { PrismaClient } from "./.prisma/client"

/**
 * The e2e suite's own Prisma client. Playwright compiles specs to CommonJS,
 * so it can load neither src/lib/db (`server-only` since the Workers move)
 * nor the app's ESM client (import.meta) — this uses the CJS twin from the
 * `e2e` generator, with db.ts's Node adapters (DATABASE_URL_ADAPTER).
 */
function nodeClient() {
  const connectionString = process.env.DATABASE_URL
  if ((process.env.DATABASE_URL_ADAPTER ?? "pg").toLowerCase() === "neon") {
    if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

export const db = nodeClient()
