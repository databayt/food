import { NextResponse, type NextRequest } from "next/server"

import { refreshByReference, refreshPendingAttempts } from "@/components/order/payment/settle"
import { db } from "@/lib/db"

/**
 * MTN MoMo Request-to-Pay callback. MTN PUTs here when a prompt is answered.
 * The body is NOT trusted — it only says which request to re-read from MTN
 * (settle.ts). Always 200 so MTN doesn't retry-storm; unknown refs no-op.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handle(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { referenceId?: unknown; externalId?: unknown } | null
  const ref = request.nextUrl.searchParams.get("ref") ?? (typeof body?.referenceId === "string" ? body.referenceId : null)
  try {
    if (ref && UUID.test(ref)) {
      await refreshByReference(ref)
    } else if (typeof body?.externalId === "string" && /^\d{1,9}$/.test(body.externalId)) {
      const order = await db.order.findUnique({
        where: { number: Number(body.externalId) },
        select: { payment: { select: { id: true } } },
      })
      if (order?.payment) await refreshPendingAttempts(order.payment.id)
    }
  } catch (error) {
    console.error("[momo callback] failed", error)
  }
  return NextResponse.json({ ok: true })
}

export const PUT = handle
export const POST = handle
