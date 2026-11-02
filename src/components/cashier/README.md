# cashier — live order queue

Route: `/[lang]/cashier` (ADMIN, CASHIER). Also owns the shared order actions.

- `queries.ts` — active orders + today's finished ones, with contact details.
- `actions.ts` — `transitionOrder` (state machine + role table in `lib/order/status.ts`, conditional update → `STALE_STATE`, history row in the same transaction), `markDispatched` (READY delivery → rider left; sets `dispatchedAt`, status stays READY), `markPaid`, `refundPayment`, `fetchCashierQueue`.
- `content.tsx` — status columns (tabs on phones), 5 s poll that keeps running behind other tabs (`staff/live-queue.ts`), new-order highlight, one next action per card.
- `order-card.tsx` — delivery cards carry Map (the guest's pin), WhatsApp (the customer) and Send to rider (`rider-message.ts`: address, pin, items, amount to collect, shared through WhatsApp's chat picker). A READY delivery's one action is "Out for delivery", then "Delivered"; pickup completes as "Picked up".
- New orders chime (`staff/sound.tsx`, Web Audio, unlocked by the first tap) and the chime repeats every 30 s while any order is still NEW; the tab title shows "(n)". Hidden tabs are throttled by the browser to about one poll a minute — keep the queue screen in front, or installed as the app.

Payment status is independent of order status: completing an order does not mark it paid.

The queue shows only **placed** orders (`placedAt` set): a MoMo order still waiting for its PIN
is invisible, and arrives already CONFIRMED (paid, chime) once MTN confirms it. Timers run from
`placedAt`, so the PIN wait never counts against the kitchen.

## pos/ — counter POS (`/[lang]/cashier/pos`, ADMIN, CASHIER)

Ring up walk-ins and phone orders: category tabs → tap to add (a required choice such as which
drink opens the item sheet; the ⚙ button opens it for extras) → ticket → charge.

- **Cash, pickup**: received amount + quick notes, change shown live; the order is PAID and
  CONFIRMED in one transaction (straight to the kitchen). Enter in the cash field charges.
- **Cash, delivery**: CONFIRMED, unpaid — the rider collects; the queue card sends the rider.
- **MoMo**: the PIN prompt goes to the customer's phone; the wait screen polls MTN every 3 s and
  places the order on confirmation. "Send again", "Take cash instead" or "Cancel" if it stalls.
- `use-ticket.ts` keeps the ticket per tab (sessionStorage) with one idempotency key per charge,
  so a retry can't ring it up twice. `receipt.tsx` prints an 80 mm receipt via `window.print()`.
- Walk-ins may have no name or phone (`customerId`/`customerPhone` null, shown as "Walk-in").
