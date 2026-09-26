import { expect, test } from "@playwright/test"

import { ordersFor, placeOrder, staffPage, testCustomer } from "./helpers"

/**
 * The golden path: customer menu → cart → checkout → confirmation →
 * cashier confirms → kitchen prepares → ready → cashier completes, with the
 * guest's tracking page following along.
 */
test("@desktop customer order flows through cashier and kitchen to completed", async ({ page, browser }) => {
  const name = testCustomer("Flow")
  const { number, token, phone } = await placeOrder(page, name, { payment: "MOMO" })
  expect(number).toBeGreaterThan(1000)
  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "NEW")
  // The guest is told how to pay, and where to collect.
  await expect(page.getByTestId("momo-pay")).toContainText("3,500 RWF")
  await expect(page.getByTestId("momo-code")).not.toBeEmpty()
  await expect(page.getByTestId("pickup-place")).toBeVisible()

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
  await expect(ticket.getByTestId("kitchen-fulfillment")).toHaveText("Pickup")
  await expect(kitchen.locator("body")).not.toContainText(phone)
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
  await expect(page.getByTestId("momo-pay")).toBeHidden({ timeout: 25_000 })
  await expect(card.getByTestId("dispatch-order")).toHaveCount(0) // pickup never goes out with a rider
  await expect(card.getByTestId("next-action")).toHaveText("Picked up")
  await card.getByTestId("next-action").click()
  await expect(card).toHaveAttribute("data-status", "COMPLETED")

  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "COMPLETED", { timeout: 25_000 })

  const [done] = await ordersFor(name)
  expect(done?.status).toBe("COMPLETED")
  expect(done?.payment?.status).toBe("PAID")
  expect(done?.payment?.reference).toBe("MP240926.1234")
  expect(done?.history.map((h) => h.to ?? h.event)).toEqual(["NEW", "CONFIRMED", "PREPARING", "READY", "PAYMENT_PAID", "COMPLETED"])
  expect(token).toHaveLength(22)
})

/**
 * Doorstep delivery: the guest shares a map pin, the cashier sees the address,
 * the pin and a ready-made rider message, sends it out, and marks it
 * delivered — the guest sees "On the way" in between.
 */
test("@desktop delivery with a map pin goes out with a rider and arrives", async ({ page, browser }) => {
  await page.context().grantPermissions(["geolocation"])
  await page.context().setGeolocation({ latitude: -1.9441, longitude: 30.0619, accuracy: 20 })
  const name = testCustomer("Rider")
  const address = "KG 11 Ave, blue gate after the pharmacy"
  const { number, phone } = await placeOrder(page, name, { fulfillment: "DELIVERY", address, shareLocation: true })

  const [order] = await ordersFor(name)
  expect(order).toMatchObject({ fulfillment: "DELIVERY", deliveryAddress: address, deliveryLat: -1.9441, deliveryLng: 30.0619 })
  await expect(page.getByTestId("pickup-place")).toHaveCount(0)

  const cashier = await staffPage(browser, "cashier")
  await cashier.goto("/en/cashier")
  // Sound is off until a tap; one tap on the toggle turns it on.
  await cashier.getByTestId("sound-toggle").click()
  await expect(cashier.getByTestId("sound-toggle")).toHaveAttribute("data-state", "on")
  const card = cashier.locator(`[data-testid="cashier-order"][data-number="${number}"]`)
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(card).toContainText(address)
  await expect(card.getByTestId("order-map")).toHaveAttribute("href", /query=-1\.944100,30\.061900/)
  await expect(card.getByTestId("whatsapp-customer")).toHaveAttribute("href", new RegExp(`wa\\.me/250${phone.replace(/\D/g, "").slice(1)}\\?text=`))
  const riderHref = decodeURIComponent((await card.getByTestId("send-to-rider").getAttribute("href")) ?? "")
  expect(riderHref).toContain(`delivery #${number}`)
  expect(riderHref).toContain(address)
  expect(riderHref).toContain(`Phone: ${phone}`)
  expect(riderHref).toContain("Collect: 3,500 RWF (Cash)")

  for (const label of ["Confirm order", "Start preparing", "Mark ready"]) {
    await expect(card.getByTestId("next-action")).toHaveText(label)
    await card.getByTestId("next-action").click()
  }
  await expect(card).toHaveAttribute("data-status", "READY")

  // READY delivery: the one action is sending it out, not completing it.
  await expect(card.getByTestId("next-action")).toHaveCount(0)
  await card.getByTestId("dispatch-order").click()
  await expect(card.getByTestId("on-the-way")).toBeVisible()
  await expect(page.locator('[data-step="ON_THE_WAY"][data-current]')).toBeVisible({ timeout: 25_000 })
  await expect(page.getByTestId("order-status")).toContainText("On its way to you!")

  await expect(card.getByTestId("next-action")).toHaveText("Delivered")
  await card.getByTestId("next-action").click()
  await expect(card).toHaveAttribute("data-status", "COMPLETED")
  await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "COMPLETED", { timeout: 25_000 })

  const [done] = await ordersFor(name)
  expect(done?.dispatchedAt).not.toBeNull()
  expect(done?.history.map((h) => h.to ?? h.event)).toEqual(["NEW", "CONFIRMED", "PREPARING", "READY", "DISPATCHED", "COMPLETED"])
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
