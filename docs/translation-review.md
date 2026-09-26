# Translation review

UI strings live in `src/components/internationalization/{en,rw,ar}.json`.
`pnpm i18n:check` (part of `pnpm build`) enforces identical keys across all
three, a label for every user-facing enum value, and zero hardcoded JSX text.

| Locale | Direction | Status |
|---|---|---|
| English (`en`, default) | LTR | Source copy |
| Arabic (`ar`) | RTL | Drafted — review by a native speaker before launch |
| Kinyarwanda (`rw`) | LTR | **Drafted, not native-reviewed — must be reviewed before launch** |

Priority strings to review in `rw.json` (what customers see first):
`order.*`, `cart.*`, `checkout.*` (incl. the new `shareLocation`, `location*`),
`track.*` (incl. `statusHint.ON_THE_WAY`, `onTheWay`, `pay*`, `pickupAt`), `enums.orderStatus.*`,
`enums.paymentMethod.*`, `enums.fulfillment.*`, `errors.PHONE_INVALID`,
`errors.ADDRESS_REQUIRED`, `errors.ITEM_UNAVAILABLE`. Staff-facing, also new:
`cashier.rider.*` (the message riders read), `cashier.dispatch`, `cashier.delivered`,
`cashier.pickedUp`, `cashier.customerMessage`, `staff.sound*`.

Menu content (item, category, extra names) is not in these files — staff edit
it per locale in Admin. Empty locales show English.

Brand and fixed tokens are intentionally not translated: "Charles Burgers",
"MTN MoMo", "RWF", "WhatsApp", "TikTok".
