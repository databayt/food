# Charles Burgers

Mobile-first ordering for **Charles Burgers**, Kigali: **SCAN → CHOOSE → ORDER**.
Guests open the menu from a QR code, order without an account, choose pickup
or delivery, pay cash or MTN MoMo, and follow their order live. Staff run a
cashier queue, a kitchen display and a small admin.

Built on databayt/mkan's infrastructure (auth, i18n, proxy, rate limiting,
Prisma 7 on Neon, UI kit) with the hogwarts mirror pattern
(`app/[lang]/<route>` ↔ `components/<feature>`).

## Routes

| Route | Who | What |
|---|---|---|
| `/` → `/{lang}/order` | everyone | Menu (QR target) |
| `/{lang}/order/cart`, `/checkout` | guests | Cart, guest checkout |
| `/{lang}/track/{token}` | guests | Live order status |
| `/{lang}/login` | staff | Sign in |
| `/{lang}/cashier` | cashier, admin | Live queue, payments |
| `/{lang}/kitchen` | kitchen, cashier, admin | Kitchen display |
| `/{lang}/admin/*` | admin | Menu, extras, categories, settings, orders, staff, QR |

Locales: `en` (default), `rw`, `ar` (RTL).

## Setup

```bash
pnpm install
cp .env.example .env          # fill DATABASE_URL, DIRECT_URL, AUTH_SECRET, SEED_ADMIN_*
pnpm db:migrate               # dev database only
pnpm seed                     # menu (create-only) + first admin
pnpm dev                      # http://localhost:3000
```

Menu photos: `pnpm menu:photos [dir]` regenerates `public/menu/*.webp` from
the owner's originals (default `~/Downloads`). See `docs/menu-sources.md`.

## Quality gates

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check && pnpm build
pnpm seed:test-staff && pnpm test:e2e   # Playwright (desktop, Pixel 7, iPhone 13, Arabic)
```

## Design notes

- **Money** is `Int` whole Rwandan francs (RWF has no minor unit). Formatted `4,000 RWF`.
- **Orders** snapshot item names (all locales), prices, modifiers and notes; menu edits never change history.
- **Order creation** is one transaction, prices come only from the database, and an idempotency key makes double-submits return the same order.
- **Status**: `NEW → CONFIRMED → PREPARING → READY → COMPLETED`, plus `CANCELLED`. Transitions are checked against the role table and the status the staff member saw. Payment status is separate.
- **Live updates** are a visibility-aware poll (5 s staff, 10 s guests) — no realtime service.
- **Privacy**: tracking pages use an unguessable token and never show phone or address; the kitchen query never reads them.

## Pending owner confirmations

WhatsApp number, delivery fee, logo, TikTok handle spelling, and native-speaker
review of Kinyarwanda and Arabic UI copy (`docs/translation-review.md`).

## References

Mkan (primary), Restro (AGPL-3.0 — ideas only), TastyIgniter (MIT), Medusa
(MIT). No code was copied from the references.
