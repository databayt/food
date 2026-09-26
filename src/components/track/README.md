# track — guest order status

Route: `/[lang]/track/[token]`. The token is 128 random bits (order numbers
can't be walked). `queries.ts` returns a customer-safe view without phone or
address; the page polls `getOrderStatus` every 10 s while visible and stops
at a terminal status.
