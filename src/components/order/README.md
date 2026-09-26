# order — guest ordering (SCAN → CHOOSE → ORDER)

Routes: `/[lang]/order` (menu, the QR target), `/[lang]/order/cart`, `/[lang]/order/checkout`.

- `menu/` — `queries.ts` loads the localized menu per request (`connection()`), `menu-board.tsx` (category chips + item rows + quick add), `item-sheet.tsx` (modifiers, quantity, note), `printed-menu.tsx`, `recent-orders.tsx` (device-only Order again).
- `cart/` — zustand + localStorage store holding **ids only**; names and prices always come from the live menu (`util.ts` mirrors server pricing for display).
- `checkout/` — `validation.ts` (Zod, codes not prose), `resolve-order.ts` (loads current rows, builds immutable snapshots), `actions.ts#createOrder`.
- Delivery takes a typed address (required) plus an optional map pin from "Share my location" (browser geolocation; `Permissions-Policy: geolocation=(self)` in `proxy.ts`). The pin is stored only for delivery orders.

## Danger zones

- `createOrder` never reads a price from the client. Unknown keys are stripped.
- One transaction writes customer, order, item + modifier snapshots, payment and history.
- The idempotency key is per checkout attempt and scoped to the cart contents (`idempotency.ts`); a duplicate returns the existing order.
