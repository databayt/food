import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Two runtimes, one `db`:
 *
 * - Cloudflare Workers (production, CF_WORKERS=1): Neon's serverless driver. A
 *   Worker's socket belongs to the request that opened it — reusing it from a
 *   later request hangs — so each request gets its own client, keyed on the
 *   per-request ctx object. (Same recipe as space and co.)
 * - Node (local dev, scripts): one client, adapter chosen by
 *   `DATABASE_URL_ADAPTER` — `neon` (HTTPS+WebSockets, works when direct TCP to
 *   Neon is blocked) or the default `pg` (direct TCP).
 */

function nodeClient() {
  const connectionString = process.env.DATABASE_URL;
  const adapterKind = (process.env.DATABASE_URL_ADAPTER ?? "pg").toLowerCase();

  let adapter;
  if (adapterKind === "neon") {
    if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;
    adapter = new PrismaNeon({ connectionString });
  } else {
    adapter = new PrismaPg({ connectionString });
  }
  return new PrismaClient({ adapter, log: ["error", "warn"], errorFormat: "minimal" });
}

function workerClient() {
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
    log: ["error", "warn"],
    errorFormat: "minimal",
  });
}

function workerCtx(): object | undefined {
  if (!process.env.CF_WORKERS) return undefined;
  try {
    return getCloudflareContext().ctx;
  } catch {
    return undefined;
  }
}

const perRequest = new WeakMap<object, PrismaClient>();
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function currentClient(): PrismaClient {
  const ctx = workerCtx();
  if (ctx) {
    let client = perRequest.get(ctx);
    if (!client) {
      client = workerClient();
      perRequest.set(ctx, client);
    }
    return client;
  }
  globalForPrisma.prisma ??= nodeClient();
  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = currentClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
