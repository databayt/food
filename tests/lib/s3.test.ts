// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { looksLike, uploadImage } from "@/lib/s3"

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>")

const ENV = {
  AWS_ACCESS_KEY_ID: "AKIATESTKEY",
  AWS_SECRET_ACCESS_KEY: "test-secret",
  AWS_S3_BUCKET: "databayt-cdn",
  AWS_REGION: "us-east-1",
  NEXT_PUBLIC_CDN_DOMAIN: "cdn.databayt.org",
}

describe("menu photo storage", () => {
  beforeEach(() => Object.assign(process.env, ENV))
  afterEach(() => {
    vi.unstubAllGlobals()
    for (const key of Object.keys(ENV)) delete process.env[key]
  })

  it("accepts only bytes that really are the claimed image type", () => {
    expect(looksLike(PNG, "image/png")).toBe(true)
    expect(looksLike(WEBP, "image/webp")).toBe(true)
    expect(looksLike(JPEG, "image/jpeg")).toBe(true)
    expect(looksLike(HTML, "image/png")).toBe(false)
    expect(looksLike(PNG, "image/webp")).toBe(false)
  })

  it("signs a PUT under the menu prefix and returns the CDN URL", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const url = await uploadImage(new Uint8Array(PNG), "image/png")

    expect(url).toMatch(/^https:\/\/cdn\.databayt\.org\/charles-burgers\/menu\/[0-9a-f-]{36}\.png$/)
    const [target, init] = fetchMock.mock.calls[0]!
    const headers = new Headers(init.headers)
    expect(init.method).toBe("PUT")
    expect(target).toBe(url.replace("https://cdn.databayt.org/", "https://databayt-cdn.s3.us-east-1.amazonaws.com/"))
    expect(headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIATESTKEY\/\d{8}\/us-east-1\/s3\/aws4_request/)
    expect(headers.get("content-type")).toBe("image/png")
    expect(headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    // A typed array (known length), never a stream: S3 needs Content-Length on PUT.
    expect(init.body).toBeInstanceOf(Uint8Array)
  })

  it("throws when S3 refuses the object", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("AccessDenied", { status: 403 })))
    await expect(uploadImage(new Uint8Array(PNG), "image/png")).rejects.toThrow("S3 PUT 403")
  })
})
