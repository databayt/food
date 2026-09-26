/**
 * Input hygiene for free text stored in the database (ported subset of mkan's
 * `src/lib/sanitization.ts`). React escapes on render; this strips what should
 * never be stored: null bytes, control characters, un-normalized unicode.
 */

/** Single-line text: names, addresses. Collapses internal whitespace. */
export function sanitizeInput(input: string): string {
  return input
    .replace(/\0/g, "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
}

/** Multi-line text: order and item notes. Keeps newlines, max 2 in a row. */
export function sanitizeMultiline(input: string): string {
  return input
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, " ")
    .normalize("NFC")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
