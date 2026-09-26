import { expect, test } from "@playwright/test"

import { addBurgerWithCheese, fillCheckout, goToCheckout, ordersFor, placeOrder, testCustomer } from "./helpers"

test("menu loads with the banner, photo cards and RWF prices, without horizontal scroll", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/en\/order$/)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Good food. Great taste.")
  await expect(page.getByTestId("banner-cta")).toBeVisible()
  await expect(page.locator('[data-item="classic-beef-burger"] img').first()).toBeVisible()
  await expect(page.locator('[data-item="classic-beef-burger"]')).toContainText("3,000 RWF")
  await expect(page.locator('[data-item="beef-pilau"]')).toContainText("4,000 RWF")
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test("empty cart shows an empty state and checkout bounces back", async ({ page }) => {
  await page.goto("/en/order/cart")
  await expect(page.getByTestId("cart-empty")).toBeVisible()
  await page.goto("/en/order/checkout")
  await expect(page).toHaveURL(/\/en\/order\/cart$/)
})

test("cart quantities update the total and lines can be removed", async ({ page }) => {
  await page.goto("/en/order")
  await addBurgerWithCheese(page)
  await page.getByTestId("cart-bar").click()
  const line = page.getByTestId("cart-line").first()
  await expect(line).toContainText("3,500 RWF")
  await line.getByRole("button", { name: "Increase quantity" }).click()
  await expect(line).toContainText("7,000 RWF")
  await line.getByRole("button", { name: "Remove" }).click()
  await expect(page.getByTestId("cart-empty")).toBeVisible()
})

test("delivery requires an address; pickup does not", async ({ page }) => {
  await page.goto("/en/order")
  await addBurgerWithCheese(page)
  await goToCheckout(page)
  const name = testCustomer("Delivery")
  await fillCheckout(page, { name, fulfillment: "DELIVERY", address: "" })
  await page.getByTestId("place-order").click()
  await expect(page.getByText("Enter a delivery address.")).toBeVisible()
  expect(await ordersFor(name)).toHaveLength(0)

  await page.locator('textarea[name="address"]').fill("KG 7 Ave, next to the pharmacy")
  await page.getByTestId("place-order").click()
  await page.waitForURL(/\/en\/track\//)
  const [order] = await ordersFor(name)
  expect(order?.fulfillment).toBe("DELIVERY")
  expect(order?.deliveryAddress).toBe("KG 7 Ave, next to the pharmacy")
})

test("rejects a non-Rwandan phone number", async ({ page }) => {
  await page.goto("/en/order")
  await addBurgerWithCheese(page)
  await goToCheckout(page)
  await fillCheckout(page, { name: testCustomer("Phone"), phone: "12345" })
  await page.getByTestId("place-order").click()
  await expect(page.getByText(/Enter a Rwandan mobile number/)).toBeVisible()
})

test("confirmation, tracking and order again without an account", async ({ page }) => {
  const name = testCustomer("Again")
  const { number } = await placeOrder(page, name)
  await expect(page.getByTestId("order-number")).toHaveText(`Order #${number}`)

  // Back on the menu, the device remembers the order.
  await page.goto("/en/order")
  await expect(page.getByText(`#${number}`)).toBeVisible()
  await page.getByRole("button", { name: "Order again" }).first().click()
  await expect(page.getByTestId("cart-bar")).toContainText("3,500 RWF")

  // Name and phone are prefilled on the next checkout.
  await goToCheckout(page)
  await expect(page.locator('input[name="name"]')).toHaveValue(name)
})
