# cashier — live order queue

Route: `/[lang]/cashier` (ADMIN, CASHIER). Also owns the shared order actions.

- `queries.ts` — active orders + today's finished ones, with contact details.
- `actions.ts` — `transitionOrder` (state machine + role table in `lib/order/status.ts`, conditional update → `STALE_STATE`, history row in the same transaction), `markPaid`, `refundPayment`, `fetchCashierQueue`.
- `content.tsx` — status columns (tabs on phones), 5 s visibility-aware poll (`staff/live-queue.ts`), new-order highlight, one next action per card.

Payment status is independent of order status: completing an order does not mark it paid.
