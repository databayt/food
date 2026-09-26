"use client"

/**
 * Browser-side upload (mkan image-optimize + image-upload-client): downscale
 * and re-encode to WebP, get a presigned URL, PUT straight to S3.
 * Throws an error whose message is a dictionary error code.
 */
async function optimizeImageFile(file: File, maxEdge = 1200, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality))
    return blob ? new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp" }) : file
  } catch {
    return file
  }
}

export async function uploadMenuImage(original: File): Promise<string> {
  const file = await optimizeImageFile(original)
  const presign = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  })
  if (!presign.ok) {
    const { error } = (await presign.json().catch(() => ({}))) as { error?: string }
    throw new Error(error ?? "UPLOAD_FAILED")
  }
  const { presignedUrl, finalUrl } = (await presign.json()) as { presignedUrl: string; finalUrl: string }
  const put = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
  if (!put.ok) throw new Error("UPLOAD_FAILED")
  return finalUrl
}
