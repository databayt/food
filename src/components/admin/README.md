# admin — restaurant management

Routes under `/[lang]/admin` (ADMIN only): `orders`, `menu`, `categories`, `modifiers`, `settings`, `staff`, `qr`.

Every action starts with `guard.ts#adminGuard` (role + rate limit), validates
with Zod (`validation.ts`), and returns error codes.

- Menu edits never alter past orders — orders carry their own snapshots.
- Availability is a toggle; removal is archive (kept for history), never delete.
- Translations: English required; empty rw/ar rows are deleted so the menu falls back to English.
- Staff are deactivated, not deleted, so audit-trail names survive. Admins cannot deactivate or demote themselves.
- Photos: Upload photo → `lib/image-upload-client.ts` (1200 px WebP) → `/api/upload` (admin, rate
  limited, real PNG/JPEG/WebP bytes only) → S3 → CDN URL in the item. Without the S3 env vars
  the button answers "not set up" and a pasted URL still works.
- Server pages build form state with `translation-draft.ts`, never with a function exported
  from a `"use client"` file — on the server that's only a client reference (React #441).

## Known upstream noise

In dev, admin pages log one hydration warning from Radix `Switch`: its hidden
form input measures the switch size on the client only (`useSize`), so the
style attribute differs from the server render. The input is invisible and
behaviour is unaffected; nothing in this repo causes it.
