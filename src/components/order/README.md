# order — guest ordering (SCAN → CHOOSE → ORDER)

Routes: `/[lang]/order` (menu, the QR target) and `/[lang]/order/checkout` — the cart's lines,
steppers and totals live on checkout (`/order/cart` redirects there), so the path is
menu → item → checkout → pay. With MTN keys set, MoMo is the default and the button sends the
PIN prompt (pay-then-place, see `payment/README.md`).

- `menu/` — `queries.ts` loads the localized menu per request (`connection()`), `menu-board.tsx` (category chips + item rows + quick add), `item-sheet.tsx` (modifiers, quantity, note), `printed-menu.tsx`, `recent-orders.tsx` (device-only Order again).
- `cart/` — zustand + localStorage store holding **ids only**; names and prices always come from the live menu (`util.ts` mirrors server pricing for display).
- `checkout/` — `validation.ts` (Zod, codes not prose), `resolve-order.ts` (loads current rows, builds immutable snapshots), `actions.ts#createOrder` (writes through `lib/order/create.ts`, shared with the counter POS).
- Delivery takes a typed address (required) plus an optional map pin from "Share my location" (browser geolocation; `Permissions-Policy: geolocation=(self)` in `proxy.ts`). The pin is stored only for delivery orders.

## Danger zones

- `createOrder` never reads a price from the client. Unknown keys are stripped.
- One transaction writes customer, order, item + modifier snapshots, payment and history (`lib/order/create.ts#insertOrder`).
- The idempotency key is per checkout attempt and scoped to the cart contents plus payment and fulfillment (`idempotency.ts`); a duplicate returns the existing order and never sends a second prompt.
- A MoMo payer number is checked against MTN's rules before anything is written.
