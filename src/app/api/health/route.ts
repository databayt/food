import { NextResponse } from "next/server"

import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

const started = Date.now()

/** Liveness + database reachability for the deploy smoke test and uptime checks. */
export async function GET() {
  const t0 = Date.now()
  let database: { pass: boolean; ms: number }
  try {
    await db.$queryRaw`SELECT 1`
    database = { pass: true, ms: Date.now() - t0 }
  } catch {
    database = { pass: false, ms: Date.now() - t0 }
  }
  return NextResponse.json(
    { status: database.pass ? "ok" : "degraded", uptime: Math.round((Date.now() - started) / 1000), database },
    { status: database.pass ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  )
}
