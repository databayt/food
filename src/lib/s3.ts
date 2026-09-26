import "server-only"

import { randomUUID } from "crypto"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/**
 * S3 image uploads (ported from mkan `src/lib/s3.ts`). Credentials are
 * OPTIONAL: without them presign returns null and the admin falls back to a
 * pasted image URL. Uploads go live once AWS_* env vars are set.
 */
const REGION = process.env.AWS_REGION || "eu-central-1"
const PREFIX = "charles-burgers/menu"

let client: S3Client | null = null

export function isS3Configured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET)
}

function s3(): S3Client | null {
  if (!isS3Configured()) return null
  client ??= new S3Client({
    region: REGION,
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
  })
  return client
}

export function publicUrlForKey(key: string): string {
  const cdn = process.env.NEXT_PUBLIC_CDN_DOMAIN?.trim()
  return cdn ? `https://${cdn}/${key}` : `https://${process.env.AWS_S3_BUCKET}.s3.${REGION}.amazonaws.com/${key}`
}

export async function presignImageUpload(contentType: string): Promise<{ presignedUrl: string; finalUrl: string } | null> {
  const c = s3()
  if (!c) return null
  const ext = contentType.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "webp"
  const key = `${PREFIX}/${randomUUID()}.${ext}`
  const presignedUrl = await getSignedUrl(
    c,
    new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: key, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }),
    { expiresIn: 300 }
  )
  return { presignedUrl, finalUrl: publicUrlForKey(key) }
}
