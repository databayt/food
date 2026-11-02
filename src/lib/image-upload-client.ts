"use client"

/**
 * Browser-side upload (mkan image-optimize): downscale and re-encode to WebP,
 * then POST it to /api/upload, which stores it on the CDN and returns the URL.
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
  const body = new FormData()
  body.append("file", file)
  const res = await fetch("/api/upload", { method: "POST", body })
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !data.url) throw new Error(data.error ?? "UPLOAD_FAILED")
  return data.url
}
