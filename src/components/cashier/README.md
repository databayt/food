# cashier — live order queue

Route: `/[lang]/cashier` (ADMIN, CASHIER). Also owns the shared order actions.

- `queries.ts` — active orders + today's finished ones, with contact details.
- `actions.ts` — `transitionOrder` (state machine + role table in `lib/order/status.ts`, conditional update → `STALE_STATE`, history row in the same transaction), `markDispatched` (READY delivery → rider left; sets `dispatchedAt`, status stays READY), `markPaid`, `refundPayment`, `fetchCashierQueue`.
- `content.tsx` — status columns (tabs on phones), 5 s poll that keeps running behind other tabs (`staff/live-queue.ts`), new-order highlight, one next action per card.
- `order-card.tsx` — delivery cards carry Map (the guest's pin), WhatsApp (the customer) and Send to rider (`rider-message.ts`: address, pin, items, amount to collect, shared through WhatsApp's chat picker). A READY delivery's one action is "Out for delivery", then "Delivered"; pickup completes as "Picked up".
- New orders chime (`staff/sound.tsx`, Web Audio, unlocked by the first tap) and the chime repeats every 30 s while any order is still NEW; the tab title shows "(n)". Hidden tabs are throttled by the browser to about one poll a minute — keep the queue screen in front, or installed as the app.

Payment status is independent of order status: completing an order does not mark it paid.
