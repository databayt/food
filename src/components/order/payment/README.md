# payment — MTN MoMo push-to-pay

The guest gets a "Pay RWF X to Charles Burgers? Enter PIN" prompt on their phone (MTN
Collection **Request to Pay**). The order turns PAID by itself, and MTN's
`financialTransactionId` (the receipt in the guest's SMS) becomes `payment.reference`.

| File | Role |
| --- | --- |
| `actions.ts` | `startMomoPayment({ token, phone? })`: guest-callable with the tracking token. Without a phone it uses the checkout number. Rate limited per IP and per order. A second tap within 2 min reuses the prompt already sent. |
| `settle.ts` | **The only code that marks MoMo money as received.** It always re-reads the status from MTN; every update is guarded by status, so a callback racing a poll settles once. |
| `momo-panel.tsx` | Tracking-page panel. Pending shows "check your phone"; paid shows the receipt; failed offers retry or another number, plus the manual merchant code. |
| `../../../lib/momo/` | Env config plus a thin MTN client (token cache, request, status). |
| `../../../app/api/momo/callback` | MTN's PUT. The body is untrusted; `?ref=` says which request to re-read. |

**How a payment settles** (there are no crons):
1. MTN's callback.
2. The guest's tracking poll, every 4 s while a prompt is out.
3. The cashier queue poll, so the payment still settles after the guest closes the tab.

A prompt that is unanswered after 10 min becomes `TIMEOUT`. If money arrives on an order the
cashier already marked paid, the history gets `PAYMENT_DUPLICATE`, meaning a refund is owed.

**Off by default.** If any `MOMO_*` key is missing, checkout keeps the manual merchant-code
flow (see `.env.example`). The sandbox accepts MTN's test MSISDNs; production accepts MTN
Rwanda 078/079 only.
