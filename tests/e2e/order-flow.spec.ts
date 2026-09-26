import { expect, test } from "@playwright/test"

import { ordersFor, placeOrder, staffPage, testCustomer } from "./helpers"

/**
 * The golden path: customer menu → cart → checkout → confirmation →
 * cashier confirms → kitchen prepares → ready → cashier completes, with the
 * guest's tracking page following along.
 */
test("@desktop customer order flows through cashier and kitchen to completed", async ({ page, browser }) => {
  const name = testCustomer("Flow")
  const { number, token } = await placeOrder(page, name, { payment: "MOMO" })
  expect(number).toBeGreaterThan(1000)
  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "NEW")

  // Stored server-side with DB prices: (3000 + 500 cheese) × 1.
  const [order] = await ordersFor(name)
  expect(order?.total).toBe(3500)
  expect(order?.payment).toMatchObject({ method: "MOMO", status: "PENDING", amount: 3500 })

  // Cashier: the new order appears without a manual refresh.
  const cashier = await staffPage(browser, "cashier")
  await cashier.goto("/en/cashier")
  const card = cashier.locator(`[data-testid="cashier-order"][data-number="${number}"]`)
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(card.getByTestId("next-action")).toHaveText("Confirm order")
  await card.getByTestId("next-action").click()
  await expect(card).toHaveAttribute("data-status", "CONFIRMED")

  // Kitchen: sees items, never contact details.
  const kitchen = await staffPage(browser, "kitchen")
  await kitchen.goto("/en/kitchen")
  const ticket = kitchen.locator(`[data-testid="kitchen-order"][data-number="${number}"]`)
  await expect(ticket).toBeVisible({ timeout: 20_000 })
  await expect(ticket).toContainText("Classic Beef Burger")
  await expect(ticket).toContainText("Cheese")
  await expect(kitchen.locator("body")).not.toContainText("078 123 4567")
  await expect(kitchen.locator("body")).not.toContainText(name)

  await ticket.getByTestId("kitchen-action").click() // Start preparing
  await expect(ticket).toHaveAttribute("data-status", "PREPARING")
  await ticket.getByTestId("kitchen-action").click() // Mark ready
  await expect(ticket).toBeHidden()

  // Guest page follows along (10 s poll).
  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "READY", { timeout: 25_000 })

  // Cashier records the MoMo payment, then completes.
  await cashier.reload()
  await expect(card).toHaveAttribute("data-status", "READY")
  await card.getByTestId("mark-paid").click()
  await cashier.getByPlaceholder(/MoMo transaction ID/).fill("MP240926.1234")
  await cashier.getByTestId("confirm-paid").click()
  await expect(card).toContainText("Paid")
  await card.getByTestId("next-action").click() // Complete
  await expect(card).toHaveAttribute("data-status", "COMPLETED")

  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "COMPLETED", { timeout: 25_000 })

  const [done] = await ordersFor(name)
  expect(done?.status).toBe("COMPLETED")
  expect(done?.payment?.status).toBe("PAID")
  expect(done?.payment?.reference).toBe("MP240926.1234")
  expect(done?.history.map((h) => h.to ?? h.event)).toEqual(["NEW", "CONFIRMED", "PREPARING", "READY", "PAYMENT_PAID", "COMPLETED"])
  expect(token).toHaveLength(22)
})

test("@desktop cashier cancels an order and the guest sees it", async ({ page, browser }) => {
  const name = testCustomer("Cancel")
  const { number } = await placeOrder(page, name)

  const cashier = await staffPage(browser, "cashier")
  await cashier.goto("/en/cashier")
  const card = cashier.locator(`[data-testid="cashier-order"][data-number="${number}"]`)
  await expect(card).toBeVisible({ timeout: 20_000 })
  await card.getByTestId("cancel-order").click()
  await cashier.getByPlaceholder("Reason (optional)").fill("Out of buns")
  await cashier.getByTestId("confirm-cancel").click()
  await expect(card).toHaveAttribute("data-status", "CANCELLED")

  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "CANCELLED", { timeout: 25_000 })
  await expect(page.getByTestId("order-status")).toContainText("This order was cancelled.")
  const [order] = await ordersFor(name)
  expect(order?.cancelReason).toBe("Out of buns")
})

test("@desktop kitchen staff cannot open the cashier or admin", async ({ browser }) => {
  const kitchen = await staffPage(browser, "kitchen")
  await kitchen.goto("/en/cashier")
  await expect(kitchen).toHaveURL(/\/en\/kitchen/)
  await kitchen.goto("/en/admin/menu")
  await expect(kitchen).toHaveURL(/\/en\/kitchen/)
})

test("@desktop anonymous visitors are sent to login", async ({ page }) => {
  await page.goto("/en/cashier")
  await expect(page).toHaveURL(/\/en\/login\?callbackUrl=/)
})
