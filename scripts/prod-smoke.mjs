#!/usr/bin/env node
/**
 * Production smoke check — the pages a guest, the cashier and the owner
 * actually open, in about a minute, with no dependencies (Node 20+ fetch).
 *
 *   node scripts/prod-smoke.mjs [baseUrl]          # default https://bu.databayt.org
 *
 * Optional deep checks (GitHub secrets in .github/workflows/prod-smoke.yml):
 *   SMOKE_TRACK_TOKEN     a real order's tracking token — the page must render it
 *   SMOKE_STAFF_EMAIL     an ADMIN login: queue, POS, kitchen and every admin editor
 *   SMOKE_STAFF_PASSWORD
 *
 * Why these: on 2026-10-24 every real tracking page and the cashier queue
 * 500'd for nine days (a migration never applied), and the admin editors had
 * crashed since launch — all invisible to a /api/health check. A server error
 * leaves a `"digest":` in the HTML; that is what this looks for.
 * Exit 1 on any failure; kun's job supervisor re-runs once, then opens a
 * job-health issue and alerts.
 */
const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "https://bu.databayt.org").replace(/\/+$/, "")
const TIMEOUT_MS = 20_000
const results = []

async function hit(path, init = {}) {
  const started = Date.now()
  const res = await fetch(BASE + path, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), ...init })
  const body = res.headers.get("content-type")?.includes("text") || res.headers.get("content-type")?.includes("json") ? await res.text() : ""
  return { res, body, ms: Date.now() - started }
}

async function check(name, path, verify, init) {
  try {
    const { res, body, ms } = await hit(path, init)
    const problem =
      res.status >= 500
        ? `HTTP ${res.status}`
        : body.includes('"digest":"') || body.includes("Something went wrong")
          ? "server error in the page"
          : verify(res, body)
    results.push({ name, path, ok: !problem, ms, note: problem || "" })
    return { res, body }
  } catch (error) {
    results.push({ name, path, ok: false, ms: TIMEOUT_MS, note: error instanceof Error ? error.message : String(error) })
    return {}
  }
}

const expect200 = (marker) => (res, body) =>
  res.status !== 200 ? `HTTP ${res.status}${res.headers.get("location") ? ` → ${res.headers.get("location")}` : ""}` : marker && !body.includes(marker) ? `missing ${marker}` : null

// --- Guests -----------------------------------------------------------------
await check("health", "/api/health", (res, body) => (res.status === 200 && JSON.parse(body).status === "ok" ? null : `HTTP ${res.status} ${body.slice(0, 80)}`))
for (const lang of ["en", "rw", "ar"]) await check(`menu ${lang}`, `/${lang}/order`, expect200("data-item="))
await check("checkout", "/en/order/checkout", expect200(null))
await check("old cart link", "/en/order/cart", (res) =>
  res.status === 307 && res.headers.get("location")?.endsWith("/en/order/checkout") ? null : `HTTP ${res.status} → ${res.headers.get("location")}`
)
await check("login form posts, never GETs", "/en/login", expect200('action="/api/staff-login"'))
if (process.env.SMOKE_TRACK_TOKEN) {
  await check("tracking a real order", `/en/track/${process.env.SMOKE_TRACK_TOKEN}`, expect200('data-testid="order-number"'))
}

// --- Staff (an admin sees every surface) --------------------------------------
if (process.env.SMOKE_STAFF_EMAIL && process.env.SMOKE_STAFF_PASSWORD) {
  const { res } = await check(
    "staff sign-in",
    "/api/staff-login",
    (r) => (r.status === 303 && !r.headers.get("location")?.includes("/login") ? null : `HTTP ${r.status} → ${r.headers.get("location")}`),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE },
      body: new URLSearchParams({ lang: "en", email: process.env.SMOKE_STAFF_EMAIL, password: process.env.SMOKE_STAFF_PASSWORD }),
    }
  )
  const cookie = (res?.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ")
  if (cookie) {
    const staff = { headers: { cookie } }
    for (const [name, path, marker] of [
      ["cashier queue", "/en/cashier", 'data-testid="live-badge"'],
      ["counter POS", "/en/cashier/pos", "data-pos-item="],
      ["kitchen display", "/en/kitchen", 'data-testid="live-badge"'],
      ["admin menu", "/en/admin/menu", 'data-testid="admin-item"'],
      ["admin new item", "/en/admin/menu/new", 'data-testid="save-item"'],
      ["admin categories", "/en/admin/categories", 'data-testid="category-card"'],
      ["admin extras", "/en/admin/modifiers", 'id="grp-'],
      ["admin settings", "/en/admin/settings", 'data-testid="save-settings"'],
      ["admin staff", "/en/admin/staff", 'id="sn-'],
      ["admin orders", "/en/admin/orders", "<table"],
    ]) {
      await check(name, path, expect200(marker), staff)
    }
  }
}

// --- Report -----------------------------------------------------------------
const failed = results.filter((r) => !r.ok)
const lines = results.map((r) => `${r.ok ? "✓" : "✗"} ${r.name.padEnd(30)} ${String(r.ms).padStart(6)} ms  ${r.note}`)
console.log(`${BASE} — ${results.length - failed.length}/${results.length} ok\n${lines.join("\n")}`)
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs")
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### ${failed.length ? "❌" : "✅"} ${BASE} — ${results.length - failed.length}/${results.length} ok\n\n| | check | ms | note |\n|---|---|---|---|\n` +
      results.map((r) => `| ${r.ok ? "✓" : "✗"} | ${r.name} | ${r.ms} | ${r.note} |`).join("\n") +
      "\n"
  )
}
process.exit(failed.length ? 1 : 0)
