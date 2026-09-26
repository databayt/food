# admin — restaurant management

Routes under `/[lang]/admin` (ADMIN only): `orders`, `menu`, `categories`, `modifiers`, `settings`, `staff`, `qr`.

Every action starts with `guard.ts#adminGuard` (role + rate limit), validates
with Zod (`validation.ts`), and returns error codes.

- Menu edits never alter past orders — orders carry their own snapshots.
- Availability is a toggle; removal is archive (kept for history), never delete.
- Translations: English required; empty rw/ar rows are deleted so the menu falls back to English.
- Staff are deactivated, not deleted, so audit-trail names survive. Admins cannot deactivate or demote themselves.

## Known upstream noise

In dev, admin pages log one hydration warning from Radix `Switch`: its hidden
form input measures the switch size on the client only (`useSize`), so the
style attribute differs from the server render. The input is invisible and
behaviour is unaffected; nothing in this repo causes it.
