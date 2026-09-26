import { NextResponse } from "next/server"

import { getStaffSession } from "@/lib/auth"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"
import { isS3Configured, presignImageUpload } from "@/lib/s3"

// Presigned PUT for admin menu photos (mkan `api/upload/presign`). The bytes
// go straight from the browser to S3; this route only mints the URL.
const ALLOWED_TYPES = ["image/webp", "image/jpeg", "image/png"]
const MAX_SIZE = 10 * 1024 * 1024

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

  const body = (await request.json().catch(() => ({}))) as { contentType?: string; size?: number }
  if (!body.contentType || !ALLOWED_TYPES.includes(body.contentType)) {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 400 })
  }
  if (typeof body.size === "number" && body.size > MAX_SIZE) {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 400 })
  }

  const result = await presignImageUpload(body.contentType)
  if (!result) return NextResponse.json({ error: "UPLOAD_DISABLED" }, { status: 503 })
  return NextResponse.json(result)
}
