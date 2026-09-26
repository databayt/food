import { expect, type Browser, type Page } from "@playwright/test"

import { db } from "../../src/lib/db"
import { authFile, type TEST_STAFF } from "./global-setup"

export { db }

let counter = 0
/** Unique, cleanup-tagged customer name. */
export function testCustomer(label = "Guest"): string {
  counter += 1
  return `E2E ${label} ${Date.now().toString(36)}${counter}`
}

/**
 * A fresh MTN number per order. Orders are rate-limited per phone (5 per
 * 10 min), so a suite that reused one number would trip its own limit.
 */
export function testPhone(): string {
  const digits = String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0")
  return `078 ${digits.slice(0, 3)} ${digits.slice(3)}`
}

export async function staffPage(browser: Browser, role: keyof typeof TEST_STAFF): Promise<Page> {
  const context = await browser.newContext({ storageState: authFile(role) })
  return context.newPage()
}

/** Classic Beef Burger with Cheese via the item sheet. */
export async function addBurgerWithCheese(page: Page) {
  await page.locator('[data-item="classic-beef-burger"]').click()
  await page.getByRole("dialog").getByText("Cheese", { exact: true }).click()
  await page.getByTestId("add-to-order").click()
  await expect(page.getByRole("dialog")).toBeHidden()
}

export async function goToCheckout(page: Page, lang = "en") {
  await page.getByTestId("cart-bar").click()
  await page.waitForURL(`**/${lang}/order/cart`)
  await page.getByTestId("go-checkout").click()
  await page.waitForURL(`**/${lang}/order/checkout`)
}

export async function fillCheckout(
  page: Page,
  opts: {
    name: string
    phone?: string
    fulfillment?: "PICKUP" | "DELIVERY"
    address?: string
    payment?: "CASH" | "MOMO"
    /** Tap "Share my location" (grant geolocation on the context first). */
    shareLocation?: boolean
  }
) {
  await page.locator('input[name="name"]').fill(opts.name)
  await page.locator('input[name="phone"]').fill(opts.phone ?? testPhone())
  if (opts.fulfillment === "DELIVERY") {
    await page.getByTestId("fulfillment-DELIVERY").click()
    if (opts.address !== undefined) await page.locator('textarea[name="address"]').fill(opts.address)
    if (opts.shareLocation) {
      await page.getByTestId("share-location").click()
      await expect(page.getByTestId("location-attached")).toBeVisible()
    }
  }
  if (opts.payment === "MOMO") await page.getByTestId("paymentMethod-MOMO").click()
}

/** Full guest order from the menu; returns the confirmation number + token. */
export async function placeOrder(page: Page, name: string, opts: Omit<Parameters<typeof fillCheckout>[1], "name"> = {}) {
  const phone = opts.phone ?? testPhone()
  await page.goto("/en/order")
  await addBurgerWithCheese(page)
  await goToCheckout(page)
  await fillCheckout(page, { name, ...opts, phone })
  await page.getByTestId("place-order").click()
  await page.waitForURL(/\/en\/track\/[\w-]{22}\?new=1/)
  await expect(page.getByTestId("order-received")).toBeVisible()
  const heading = await page.getByTestId("order-number").innerText()
  const number = Number(heading.match(/(\d+)/)?.[1])
  const token = page.url().match(/track\/([\w-]{22})/)?.[1] ?? ""
  return { number, token, phone }
}

export async function ordersFor(name: string) {
  return db.order.findMany({ where: { customerName: name }, include: { items: { include: { modifiers: true } }, payment: true, history: { orderBy: { createdAt: "asc" } } } })
}
