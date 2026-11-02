import "server-only"

import { AwsClient } from "aws4fetch"

/**
 * Menu photo storage: S3 (databayt-cdn), served through the CDN
 * (cdn.databayt.org). Uploads go browser → /api/upload → S3, so the bucket
 * needs no CORS rule for PUT, and the request is signed with aws4fetch
 * (fetch + WebCrypto) — the same code runs in Node and on the Workers
 * runtime. Without the AWS_* env vars uploads are off and the admin pastes a
 * photo URL instead.
 */
const PREFIX = "charles-burgers/menu"

/** Accepted photo types → stored extension. */
export const UPLOAD_TYPES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } as const
export type UploadType = keyof typeof UPLOAD_TYPES
/** The browser already downsizes to 1200 px WebP (~150 KB); this only stops abuse. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const region = () => process.env.AWS_REGION?.trim() || "us-east-1"

export function isS3Configured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET)
}

export function publicUrlForKey(key: string): string {
  const cdn = process.env.NEXT_PUBLIC_CDN_DOMAIN?.trim()
  return cdn ? `https://${cdn}/${key}` : `https://${process.env.AWS_S3_BUCKET}.s3.${region()}.amazonaws.com/${key}`
}

/** The bytes must really be the image type they claim (no HTML/SVG on the CDN). */
export function looksLike(bytes: Uint8Array, type: UploadType): boolean {
  const at = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b)
  if (type === "image/png") return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (type === "image/jpeg") return at(0, [0xff, 0xd8, 0xff])
  return at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50]) // RIFF....WEBP
}

/** Store one menu photo; returns its public URL. Throws when S3 refuses it. */
export async function uploadImage(bytes: Uint8Array<ArrayBuffer>, type: UploadType): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET!
  const aws = new AwsClient({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: region(),
    service: "s3",
    retries: 0, // the admin sees the error and taps again; no silent minute of backoff
  })
  const key = `${PREFIX}/${crypto.randomUUID()}.${UPLOAD_TYPES[type]}`
  const headers = { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" }
  const signed = await aws.sign(`https://${bucket}.s3.${region()}.amazonaws.com/${key}`, { method: "PUT", body: bytes, headers })
  // Send the bytes ourselves, not the signed Request: a Request body goes out
  // chunked, and S3 answers a PUT without Content-Length with 501.
  const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: bytes })
  if (!res.ok) throw new Error(`S3 PUT ${res.status}`)
  return publicUrlForKey(key)
}
