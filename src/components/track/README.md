# track — guest order status

Route: `/[lang]/track/[token]`. The token is 128 random bits (order numbers
can't be walked). `queries.ts` returns a customer-safe view without phone or
address; the page polls `getOrderStatus` every 10 s while visible and stops
at a terminal status.

- Delivery orders show an extra "On the way" step once the cashier sends the
  rider (`dispatchedAt`); the phone buzzes and the tab retitles when the food
  is ready for pickup or on its way.
- An unpaid MoMo order shows the merchant code and the exact amount to send.
- Pickup orders show the restaurant's address with a Google Maps link.
