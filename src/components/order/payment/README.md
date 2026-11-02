# payment — MTN MoMo push-to-pay (pay-then-place)

The guest gets a "Pay RWF X to Charles Burgers? Enter PIN" prompt on their phone (MTN
Collection **Request to Pay**) the moment they tap **Pay with MoMo** at checkout — the PIN is
their last step. The order is written as `AWAITING_PAYMENT`, which no staff screen shows; MTN's
confirmation marks it PAID and places it as **CONFIRMED** in the same transaction (straight to
the kitchen, no cashier confirmation). MTN's `financialTransactionId` (the receipt in the
guest's SMS) becomes `payment.reference`. The counter POS uses the same path.

| File | Role |
| --- | --- |
| `prompt.ts` | `sendMomoPrompt`: records a PaymentAttempt and calls MTN. Used by checkout, the POS and "send again". |
| `actions.ts` | `startMomoPayment({ token, phone? })` ("send again"/another number; rate limited per IP and per order; a second tap within 2 min reuses the prompt). `payCashInstead({ token })` releases a waiting order to the cashier as NEW cash. |
| `settle.ts` | **The only code that marks MoMo money as received — and places a paid order.** It always re-reads the status from MTN; every update is guarded by status, so a callback racing a poll settles and places once. `expireUnpaidOrders` cancels waiting orders nobody paid. |
| `momo-panel.tsx` | Tracking-page panel. Pending shows "check your phone"; paid shows the receipt; failed offers retry or another number, plus the manual merchant code. |
| `../../../lib/momo/` | Env config plus a thin MTN client (token cache, request, status). |
| `../../../app/api/momo/callback` | MTN's PUT. The body is untrusted; `?ref=` says which request to re-read. |

**How a payment settles** (there are no crons):
1. MTN's callback.
2. The guest's tracking poll, every 4 s while a prompt is out.
3. The cashier queue poll, so the payment still settles after the guest closes the tab.

A prompt that is unanswered after 10 min becomes `TIMEOUT`; a waiting order with no prompt out
for 15 min is cancelled (`UNPAID`, never shown to staff). If money arrives on an order already
marked paid, the history gets `PAYMENT_DUPLICATE`; on an order that had expired, it is shown to
staff as cancelled + paid — either way a refund is owed.

**MTN's WAF**: a `#` (and other punctuation) in `payerMessage` gets an HTML "Request Rejected"
with HTTP 200 and no prompt — `client.ts#payerText` keeps only letters, digits, spaces, `.`, `-`.

**Off by default.** If any `MOMO_*` key is missing, checkout keeps the manual merchant-code
flow (see `.env.example`). Dev sandbox: `scripts/momo-sandbox-provision.sh --env .env`, then
`pnpm momo:smoke`. The sandbox "pays" any ordinary number (46733123450 fails, …451 declines),
so **sandbox keys never go to production**; production needs MTN Rwanda (`mtnrwanda`, RWF)
keys from the restaurant's own merchant account, and accepts 078/079 only.
