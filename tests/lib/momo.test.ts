import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { callbackFor, getRequestToPayStatus, mapMomoStatus, requestToPay, resetMomoTokenCache } from "@/lib/momo/client"
import { getMomoConfig, toMomoPayer, type MomoConfig } from "@/lib/momo/config"

const config: MomoConfig = {
  baseUrl: "https://sandbox.momodeveloper.mtn.com",
  targetEnv: "sandbox",
  subscriptionKey: "sub",
  apiUser: "user",
  apiKey: "key",
  callbackUrl: "https://bu.databayt.org/api/momo/callback",
  currency: "EUR",
}

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => handler(String(url), init ?? {}))
  vi.stubGlobal("fetch", fn)
  return fn
}

const tokenResponse = () => Response.json({ access_token: "tok", token_type: "access_token", expires_in: 3600 })

describe("momo config", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("is off until every key is set", () => {
    vi.stubEnv("MOMO_BASE_URL", "https://sandbox.momodeveloper.mtn.com/")
    vi.stubEnv("MOMO_TARGET_ENV", "sandbox")
    vi.stubEnv("MOMO_SUBSCRIPTION_KEY", "sub")
    vi.stubEnv("MOMO_API_USER", "user")
    vi.stubEnv("MOMO_API_KEY", "")
    expect(getMomoConfig()).toBeNull()
    vi.stubEnv("MOMO_API_KEY", " key\n")
    expect(getMomoConfig()).toMatchObject({ baseUrl: "https://sandbox.momodeveloper.mtn.com", apiKey: "key", currency: "RWF" })
  })

  it("takes MTN Rwanda numbers only, plus test MSISDNs in the sandbox", () => {
    expect(toMomoPayer("078 123 4567", false)).toBe("+250781234567")
    expect(toMomoPayer("+250791234567", false)).toBe("+250791234567")
    expect(toMomoPayer("0731234567", false)).toBeNull() // Airtel
    expect(toMomoPayer("46733123450", false)).toBeNull()
    expect(toMomoPayer("46733123450", true)).toBe("+46733123450")
  })
})

describe("momo client", () => {
  beforeEach(() => resetMomoTokenCache())
  afterEach(() => vi.unstubAllGlobals())

  it("sends Request to Pay with the reference, payer and callback", async () => {
    const fetch = mockFetch((url) => (url.endsWith("/collection/token/") ? tokenResponse() : new Response(null, { status: 202 })))
    await requestToPay(config, { referenceId: "ref-1", amount: 8000, payer: "+250781234567", externalId: "1042", message: "Charles Burgers #1042" })

    const [, init] = fetch.mock.calls[1]!
    const headers = init!.headers as Record<string, string>
    expect(headers["X-Reference-Id"]).toBe("ref-1")
    expect(headers["X-Target-Environment"]).toBe("sandbox")
    expect(headers["X-Callback-Url"]).toBe(callbackFor(config.callbackUrl!, "ref-1"))
    expect(JSON.parse(init!.body as string)).toMatchObject({
      amount: "8000",
      currency: "EUR",
      externalId: "1042",
      payer: { partyIdType: "MSISDN", partyId: "250781234567" },
    })
  })

  it("caches the token across calls", async () => {
    const fetch = mockFetch((url) => (url.endsWith("/collection/token/") ? tokenResponse() : Response.json({ status: "PENDING" })))
    await getRequestToPayStatus(config, "ref-1")
    await getRequestToPayStatus(config, "ref-2")
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith("/collection/token/"))).toHaveLength(1)
  })

  it("maps provider failures to codes", async () => {
    mockFetch((url) => (url.endsWith("/collection/token/") ? tokenResponse() : new Response(null, { status: 500 })))
    await expect(
      requestToPay(config, { referenceId: "r", amount: 1, payer: "+250781234567", externalId: "1", message: "x" })
    ).rejects.toMatchObject({ code: "MOMO_UNAVAILABLE" })
    mockFetch((url) => (url.endsWith("/collection/token/") ? tokenResponse() : new Response(null, { status: 400 })))
    await expect(
      requestToPay(config, { referenceId: "r", amount: 1, payer: "+250781234567", externalId: "1", message: "x" })
    ).rejects.toMatchObject({ code: "MOMO_REJECTED" })
  })

  it("reads the receipt only from a successful status", () => {
    expect(mapMomoStatus({ status: "SUCCESSFUL", financialTransactionId: "123456789" })).toEqual({
      status: "SUCCESSFUL",
      financialTransactionId: "123456789",
      reason: null,
    })
    expect(mapMomoStatus({ status: "FAILED", reason: "APPROVAL_REJECTED", financialTransactionId: "x" })).toEqual({
      status: "REJECTED",
      financialTransactionId: null,
      reason: "APPROVAL_REJECTED",
    })
    expect(mapMomoStatus({ status: "FAILED", reason: { code: "EXPIRED" } }).status).toBe("TIMEOUT")
    expect(mapMomoStatus({ status: "FAILED", reason: "NOT_ENOUGH_FUNDS" }).status).toBe("FAILED")
    expect(mapMomoStatus({ status: "PENDING" }).status).toBe("PENDING")
  })
})
