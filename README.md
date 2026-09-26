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

Item photos: `pnpm items:photos` cuts the supplied photos (fake checkerboard
backgrounds) into transparent `public/items/<slug>.webp`; `pnpm items:attach`
links them to items that have no photo yet. Prices: see `docs/menu-sources.md`.

## Quality gates

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check && pnpm build
pnpm seed:test-staff && pnpm test:e2e   # Playwright (desktop, Pixel 7, iPhone 13, Arabic)
```

## Deploy (Cloudflare Containers — the mkan/hogwarts lane)

Live at **https://bu.databayt.org** (Worker `food`, also `food.osmanabdout.workers.dev`).
DNS: proxied `AAAA bu 100::` in the `databayt.org` zone; the Worker route `bu.databayt.org/*` serves it.
Database: Neon project `food`, branch `main` (production). `.env` points at `dev`.

Production values live only in the macOS Keychain as `cf-food-<VAR>` (no Vercel project):

```bash
F="$TMPDIR/food-prod.env"; scripts/cf-keychain-env.sh > "$F"      # never print it
scripts/deploy-cloudflare.sh "$F" build     # standalone build of HEAD (CF_SOURCE=worktree for uncommitted)
scripts/deploy-cloudflare.sh "$F" smoke     # linux/amd64 image on :3300, curl table — read it
scripts/cf-secrets.sh "$F"                  # only when a secret changed
scripts/deploy-cloudflare.sh "$F" deploy    # wrangler pushes the image, swaps the container
curl -s https://bu.databayt.org/api/health  # uptime resets when the new container serves
```

Schema changes: `DATABASE_URL=$DIRECT DIRECT_URL=$DIRECT pnpm exec prisma migrate deploy` against
`main` **before** deploying code that needs them (take a Neon restore-point branch first).
The production admin is `admin@charlesburgers.rw`; its password is Keychain `cf-food-SEED_ADMIN_PASSWORD`.

## Design notes

- **Money** is `Int` whole Rwandan francs (RWF has no minor unit). Formatted `4,000 RWF`.
- **Orders** snapshot item names (all locales), prices, modifiers and notes; menu edits never change history.
- **Order creation** is one transaction, prices come only from the database, and an idempotency key makes double-submits return the same order.
- **Status**: `NEW → CONFIRMED → PREPARING → READY → COMPLETED`, plus `CANCELLED`. Transitions are checked against the role table and the status the staff member saw. Payment status is separate.
- **Delivery**: the guest types an address and can attach a map pin ("Share my location"). The cashier card opens the pin in Google Maps, messages the customer on WhatsApp, and sends the rider one WhatsApp message with address, pin, items and the amount to collect. "Out for delivery" stamps `dispatchedAt` (the status stays READY) and the guest sees "On the way"; "Delivered" completes it.
- **Live updates** are a poll (5 s staff, 10 s guests) — no realtime service. Staff screens keep polling behind other tabs, chime on new orders and repeat the chime every 30 s while an order waits for confirmation.
- **Privacy**: tracking pages use an unguessable token and never show phone or address; the kitchen query never reads them.

## Pending owner confirmations

WhatsApp number, delivery fee, logo, TikTok handle spelling, and native-speaker
review of Kinyarwanda and Arabic UI copy (`docs/translation-review.md`).

Before taking real orders (all in Admin, no code):

- **Staff accounts** — production has only the admin. Add a Cashier login for the
  counter phone/tablet and a Kitchen login (Admin → Staff). A NEW order waits for
  a cashier or admin to confirm it before the kitchen sees it.
- **Pickup address** — the street address and landmark (Admin → Settings); guests
  collecting an order see it with a Directions link. Today it reads "Kigali, Rwanda".
- **Delivery fee** — 0 today, shown as "confirmed by the restaurant", so the stored
  total excludes it and the rider message asks for the food total only. Set a flat
  fee in Admin → Settings, or turn delivery off until one is agreed.
- **MoMo** — the tracking page shows the merchant code and amount. A tap-to-dial
  MoMoPay USSD code was left out until the owner confirms the exact string.

## References

Mkan (primary), Restro (AGPL-3.0 — ideas only), TastyIgniter (MIT), Medusa
(MIT). No code was copied from the references.
