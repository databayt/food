# kitchen — kitchen display

Route: `/[lang]/kitchen` (ADMIN, CASHIER, KITCHEN).

`queries.ts` is the privacy boundary: its `select` reads only number, time,
items, modifiers, notes, status and pickup/delivery (so delivery gets packed
for the ride) — never phone, address, payment or totals. Newly confirmed
orders chime like the cashier queue.
The kitchen role may only move CONFIRMED → PREPARING → READY.
