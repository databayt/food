import { NextResponse } from "next/server"

import { getStaffSession } from "@/lib/auth"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"
import { isS3Configured, looksLike, MAX_UPLOAD_BYTES, UPLOAD_TYPES, uploadImage, type UploadType } from "@/lib/s3"

/**
 * Admin menu photo upload: multipart `file` in, `{ url }` (CDN) out. The bytes
 * pass through the app — the shared bucket has no CORS rule for browser PUTs —
 * and are checked to really be a PNG, JPEG or WebP before they reach the CDN.
 */
export async function POST(request: Request) {
  const session = await getStaffSession(["ADMIN"])
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })

  try {
    await assertRateLimit("upload", session.user.id)
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 })
    throw error
  }
  if (!isS3Configured()) return NextResponse.json({ error: "UPLOAD_DISABLED" }, { status: 503 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof Blob) || !(file.type in UPLOAD_TYPES) || file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 400 })
  }
  const type = file.type as UploadType
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!looksLike(bytes, type)) return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 400 })

  try {
    return NextResponse.json({ url: await uploadImage(bytes, type) })
  } catch (error) {
    console.error("[upload] failed", error)
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 502 })
  }
}
