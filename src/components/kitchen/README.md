# kitchen — kitchen display

Route: `/[lang]/kitchen` (ADMIN, CASHIER, KITCHEN).

`queries.ts` is the privacy boundary: its `select` reads only number, time,
items, modifiers, notes and status — never phone, address, payment or totals.
The kitchen role may only move CONFIRMED → PREPARING → READY.
