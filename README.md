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
| `/{lang}/order/checkout` | guests | Cart + guest checkout on one page (`/order/cart` redirects) |
| `/{lang}/track/{token}` | guests | Live order status |
| `/{lang}/login` | staff | Sign in |
| `/{lang}/cashier` | cashier, admin | Live queue, payments |
| `/{lang}/cashier/pos` | cashier, admin | Counter POS: walk-ins and phone orders, cash with change or MoMo push |
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
New photos from Admin → Menu → Upload photo: the browser shrinks them to a 1200 px WebP and
posts them to `/api/upload`, which checks the bytes and stores them on S3 `databayt-cdn`
(`charles-burgers/menu/`), served from `cdn.databayt.org` (`AWS_*`, `AWS_S3_BUCKET`,
`NEXT_PUBLIC_CDN_DOMAIN`; Keychain `cf-food-*` in production). No bucket CORS needed.

## Quality gates

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check && pnpm build
pnpm seed:test-staff && pnpm test:e2e   # Playwright (desktop, Pixel 7, iPhone 13, Arabic)
scripts/momo-sandbox-provision.sh --env .env && pnpm momo:smoke   # MTN sandbox keys, then a real sandbox payment
```

With sandbox keys in `.env`, `tests/e2e/momo.spec.ts` and the POS MoMo test run pay-then-place
against the real MTN sandbox. Playwright reads the database through a CommonJS Prisma client
(`generator e2e` → `tests/e2e/.prisma`), because it can't load the app's ESM one.

## Deploy (Cloudflare Workers via OpenNext — no container, the space/co lane)

Live at **https://bu.databayt.org** (Worker `food`, also `food.osmanabdout.workers.dev`).
DNS: proxied `AAAA bu 100::` in the `databayt.org` zone; the Worker route `bu.databayt.org/*` serves it.
Database: Neon project `food`, branch `main` (production). `.env` points at `dev`.

Production values live only in the macOS Keychain as `cf-food-<VAR>` (no Vercel project):

```bash
F="$HOME/.cache/food-prod.env"; (umask 077; scripts/cf-keychain-env.sh > "$F")   # never print it
scripts/deploy-cloudflare.sh "$F" build     # OpenNext build of HEAD (commit first) in ~/.cache/cf-build/food-next; aborts over 10 MB gzip
scripts/deploy-cloudflare.sh "$F" preview   # optional: real workerd on :8788 against the real DB
scripts/deploy-cloudflare.sh "$F" deploy    # pushes secrets, populates the KV cache, wrangler deploy
curl -s https://bu.databayt.org/api/health  # uptime resets when the new version serves
```

`CF_WORKER_NAME=food-next` deploys a trial Worker (no route) for verification; roll back with `wrangler rollback`.

The Worker uses Smart Placement (`wrangler.jsonc`): it runs next to the Neon database in
Frankfurt rather than at the visitor's edge, so the menu's sequential queries stay local.

**Watching production.** `.github/workflows/prod-smoke.yml` runs `pnpm smoke:prod` every hour:
health, the menu in en/rw/ar, checkout, the cart redirect, the safe login form, a real tracking
page, and — signed in as the admin (repo secrets `SMOKE_*`) — the cashier queue, POS, kitchen and
every admin editor. A server error anywhere fails it; kun's job supervisor re-runs it once, then
opens a `job-health` issue. **Backups:** Neon point-in-time restore covers 6 h; a daily snapshot
(23:00 UTC, kept 14 days) covers the rest — restore one with Neon `restore_snapshot`.

Schema changes: `DATABASE_URL=$DIRECT DIRECT_URL=$DIRECT pnpm exec prisma migrate deploy` against
`main` **before** deploying code that needs them (take a Neon restore-point branch first).
The production admin is `admin@charles.com`; its password is Keychain `cf-food-SEED_ADMIN_PASSWORD`.

## Design notes

- **Money** is `Int` whole Rwandan francs (RWF has no minor unit). Formatted `4,000 RWF`.
- **Orders** snapshot item names (all locales), prices, modifiers and notes; menu edits never change history.
- **Order creation** is one transaction, prices come only from the database, and an idempotency key makes double-submits return the same order.
- **Status**: `NEW → CONFIRMED → PREPARING → READY → COMPLETED`, plus `CANCELLED`. Transitions are checked against the role table and the status the staff member saw. Payment status is separate. `AWAITING_PAYMENT` comes before the flow: a MoMo order waiting for the guest's PIN, invisible to staff (`placedAt` is null until it's placed).
- **Delivery**: the guest types an address and can attach a map pin ("Share my location"). The cashier card opens the pin in Google Maps, messages the customer on WhatsApp, and sends the rider one WhatsApp message with address, pin, items and the amount to collect. "Out for delivery" stamps `dispatchedAt` (the status stays READY) and the guest sees "On the way"; "Delivered" completes it.
- **MoMo pay-then-place**: with the `MOMO_*` keys set, MoMo is the default and "Pay with MoMo" sends an MTN Request-to-Pay PIN prompt from checkout — the PIN is the guest's last step. MTN's status read-back (callback or poll) marks it paid, stores the receipt number and places the order as CONFIRMED, straight to the kitchen. A declined guest can retry, use another number or pay cash instead; an unpaid order is cancelled after 15 min. Without the keys, the guest pays to the merchant code by hand. See `src/components/order/payment/README.md`.
- **Counter POS**: the cashier rings up a ticket in a few taps. Cash pickup is paid on the spot with change shown and goes straight to the kitchen; a delivery is collected by the rider; MoMo pushes the PIN prompt to the customer's phone and places the order once paid. Prints an 80 mm receipt. See `src/components/cashier/README.md`.
- **Menu cache**: the menu (per locale) and the restaurant settings are cached with tags
  (`lib/cache-tags.ts`) — the nested menu read is nine sequential queries. Every admin write
  expires them at once (`admin/guard.ts#revalidateAll`, `revalidateTag(…, { expire: 0 })`), and an
  order rejected because an item or option changed expires the menu too. Writes outside the admin
  (seed scripts, SQL) show within 5 minutes. Prices and availability are always re-read from the
  database at checkout and at the POS, never from the cache.
- **Live updates** are a poll (5 s staff, 10 s guests) — no realtime service. Staff screens keep polling behind other tabs, chime on new orders and repeat the chime every 30 s while an order waits for confirmation.
- **Privacy**: tracking pages use an unguessable token and never show phone or address; the kitchen query never reads them.

## Pending owner confirmations

WhatsApp number, delivery fee, logo, TikTok handle spelling, and native-speaker
review of Kinyarwanda and Arabic UI copy (`docs/translation-review.md`).

Before taking real orders (all in Admin, no code):

- **Staff accounts** — done 2026-11-03: `cashier@charles.com` and
  `kitchen@charles.com` (admin: `admin@charles.com`), passwords in Keychain `cf-food-CASHIER_PASSWORD` /
  `cf-food-KITCHEN_PASSWORD` (`security find-generic-password -s cf-food-CASHIER_PASSWORD -w`).
  More staff, password resets and deactivation: Admin → Staff. A NEW (cash) order waits for a
  cashier or admin to confirm it before the kitchen sees it; paid orders go straight there.
- **Pickup address** — the street address and landmark (Admin → Settings); guests
  collecting an order see it with a Directions link. Today it reads "Kigali, Rwanda".
- **Delivery fee** — 0 today, shown as "confirmed by the restaurant", so the stored
  total excludes it and the rider message asks for the food total only. Set a flat
  fee in Admin → Settings, or turn delivery off until one is agreed.
- **MoMo** — production has no `MOMO_*` keys, so the tracking page shows the merchant code and
  amount (manual). Push-to-pay (pay-then-place, POS MoMo) needs MTN Rwanda production keys from
  the restaurant's merchant account (KYB with MTN) stored as Keychain `cf-food-MOMO_*` and added
  to `scripts/cf-keychain-env.sh`. **Never the sandbox keys** — the sandbox approves any number.
  A tap-to-dial MoMoPay USSD code was left out until the owner confirms the exact string.

## References

Mkan (primary), Restro (AGPL-3.0 — ideas only), TastyIgniter (MIT), Medusa
(MIT). No code was copied from the references.
