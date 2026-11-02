import { expect, test } from "@playwright/test"

import { addBurgerWithCheese, fillCheckout, goToCheckout, momoSandbox, ordersFor, staffPage, testCustomer } from "./helpers"

/**
 * Pay-then-place against the real MTN sandbox: the PIN prompt goes out from
 * checkout's last step and the order reaches staff only once MTN says paid.
 * The sandbox approves ordinary numbers at once and declines 46733123451.
 */
test.skip(!momoSandbox, "needs MTN MoMo sandbox keys — scripts/momo-sandbox-provision.sh --env .env")

test("@desktop a MoMo order is placed by MTN's confirmation, straight to the kitchen", async ({ page, browser }) => {
  const name = testCustomer("MoMo")
  await page.goto("/en/order")
  await addBurgerWithCheese(page)
  await goToCheckout(page)
  await fillCheckout(page, { name, payment: "MOMO" })
  await expect(page.getByTestId("place-order")).toContainText("with MoMo")
  await page.getByTestId("place-order").click()
  await page.waitForURL(/\/en\/track\/[\w-]{22}\?new=1/)

  // MTN confirms → the page turns into the live order, already confirmed.
  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "CONFIRMED", { timeout: 30_000 })
  await expect(page.getByTestId("order-received")).toContainText("Paid")
  await expect(page.getByTestId("momo-receipt")).not.toBeEmpty()

  const [order] = await ordersFor(name)
  expect(order?.status).toBe("CONFIRMED")
  expect(order?.placedAt).not.toBeNull()
  expect(order?.payment).toMatchObject({ method: "MOMO", status: "PAID", provider: "MTN_MOMO" })
  // Same-transaction rows share a timestamp, so compare as a set.
  expect(order?.history.map((h) => h.to ?? h.event).sort()).toEqual(["AWAITING_PAYMENT", "CONFIRMED", "PAYMENT_PAID"])

  // The kitchen has it without anyone confirming it.
  const kitchen = await staffPage(browser, "kitchen")
  await kitchen.goto("/en/kitchen")
  await expect(kitchen.locator(`[data-testid="kitchen-order"][data-number="${order!.number}"]`)).toBeVisible({ timeout: 20_000 })
})

test("@desktop a declined MoMo payment never reaches staff, and can switch to cash", async ({ page, browser }) => {
  const name = testCustomer("Declined")
  await page.goto("/en/order")
  await addBurgerWithCheese(page)
  await goToCheckout(page)
  await fillCheckout(page, { name, payment: "MOMO", momoPhone: "46733123451" })
  await page.getByTestId("place-order").click()
  await page.waitForURL(/\/en\/track\//)

  await expect(page.getByTestId("momo-push")).toHaveAttribute("data-attempt", "REJECTED", { timeout: 30_000 })
  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "AWAITING_PAYMENT")
  const [waiting] = await ordersFor(name)
  expect(waiting).toMatchObject({ status: "AWAITING_PAYMENT", placedAt: null })

  // The cashier never sees it…
  const cashier = await staffPage(browser, "cashier")
  await cashier.goto("/en/cashier")
  await expect(cashier.getByTestId("live-badge")).toBeVisible()
  const card = cashier.locator(`[data-testid="cashier-order"][data-number="${waiting!.number}"]`)
  await expect(card).toHaveCount(0)

  // …until the guest chooses cash: then it is an ordinary new order.
  await page.getByTestId("pay-cash-instead").click()
  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "NEW", { timeout: 15_000 })
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(card).toHaveAttribute("data-status", "NEW")
  const [released] = await ordersFor(name)
  expect(released?.payment).toMatchObject({ method: "CASH", status: "PENDING" })
})
