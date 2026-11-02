/**
 * MTN MoMo SANDBOX smoke test — one Request to Pay per MSISDN through the
 * app's own client (src/lib/momo), then poll each until it leaves PENDING.
 * A green run proves the keys, the token cache and the status mapping the
 * checkout relies on. Refuses to run against anything but the sandbox.
 *
 *   tsx --conditions=react-server scripts/momo-smoke.ts            # default test numbers
 *   tsx --conditions=react-server scripts/momo-smoke.ts 46733123450 0788123456
 *
 * Observed 2026-11-02: 46733123450 FAILED, 46733123451 REJECTED, an ordinary
 * MTN Rwanda number (0788…) SUCCESSFUL with a receipt — the sandbox "pays"
 * real-looking numbers, so sandbox keys must never reach production.
 */
import "dotenv/config"

import { getRequestToPayStatus, requestToPay } from "../src/lib/momo/client"
import { getMomoConfig, toMomoPayer } from "../src/lib/momo/config"

const DEFAULT_NUMBERS = ["0788123456", "46733123450", "46733123451"]
const POLL_MS = 2_000
const GIVE_UP_MS = 45_000

async function payAndWait(raw: string) {
  const config = getMomoConfig()!
  const payer = toMomoPayer(raw, true)
  if (!payer) return { raw, status: "INVALID_NUMBER" }
  const referenceId = crypto.randomUUID()
  // No callback: these references are not orders, production would only no-op them.
  await requestToPay({ ...config, callbackUrl: null }, {
    referenceId,
    amount: 100,
    payer,
    externalId: "smoke",
    message: "Charles Burgers smoke test",
  })
  const started = Date.now()
  for (;;) {
    const result = await getRequestToPayStatus(config, referenceId)
    if (result.status !== "PENDING" || Date.now() - started > GIVE_UP_MS) {
      return {
        raw,
        status: result.status,
        reason: result.reason,
        receipt: result.financialTransactionId ? `${result.financialTransactionId.slice(0, 4)}…` : null,
        seconds: Math.round((Date.now() - started) / 1000),
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

async function main() {
  const config = getMomoConfig()
  if (!config) throw new Error("MOMO_* keys missing — run scripts/momo-sandbox-provision.sh --env .env")
  if (config.targetEnv !== "sandbox") throw new Error(`refusing: MOMO_TARGET_ENV is ${config.targetEnv}, not sandbox`)

  const numbers = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_NUMBERS
  const results = await Promise.all(numbers.map((n) => payAndWait(n).catch((e: Error) => ({ raw: n, status: "ERROR", reason: e.message }))))
  console.table(results)
  if (!results.some((r) => r.status === "SUCCESSFUL")) throw new Error("no sandbox payment succeeded")
  console.log("✓ MTN MoMo sandbox: request-to-pay + status read-back work")
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
