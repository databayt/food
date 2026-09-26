import { expect, test } from "@playwright/test"

import { addBurgerWithCheese, fillCheckout, goToCheckout, ordersFor, testCustomer } from "./helpers"

/** Server actions POST their arguments as a JSON array to the page URL. */
const isAction = (method: string, headers: Record<string, string>) => method === "POST" && !!headers["next-action"]

test("@desktop a manipulated client price is ignored", async ({ page }) => {
  await page.goto("/en/order")
  await addBurgerWithCheese(page)
  await goToCheckout(page)
  const name = testCustomer("Tamper")
  await fillCheckout(page, { name })

  await page.route("**/en/order/checkout", async (route) => {
    const req = route.request()
    if (!isAction(req.method(), req.headers())) return route.continue()
    const args = JSON.parse(req.postData() ?? "[]") as Array<Record<string, unknown>>
    const payload = args[0] as { lines: Array<Record<string, unknown>> } & Record<string, unknown>
    payload.total = 1
    payload.subtotal = 1
    payload.lines = payload.lines.map((l) => ({ ...l, price: 1, unitPrice: 1, lineTotal: 1 }))
    await route.continue({ postData: JSON.stringify(args) })
  })

  await page.getByTestId("place-order").click()
  await page.waitForURL(/\/en\/track\//)
  const [order] = await ordersFor(name)
  expect(order?.total).toBe(3500)
  expect(order?.items[0]?.unitPrice).toBe(3000)
})

test("@desktop a duplicated submission creates exactly one order", async ({ page }) => {
  await page.goto("/en/order")
  await addBurgerWithCheese(page)
  await goToCheckout(page)
  const name = testCustomer("Double")
  await fillCheckout(page, { name })

  // Replay the same action request twice (a double tap / retry on a flaky link).
  await page.route("**/en/order/checkout", async (route) => {
    const req = route.request()
    if (!isAction(req.method(), req.headers())) return route.continue()
    await route.fetch()
    const second = await route.fetch()
    await route.fulfill({ response: second })
  })

  await page.getByTestId("place-order").click()
  await page.waitForURL(/\/en\/track\//)
  expect(await ordersFor(name)).toHaveLength(1)
})

test("@desktop offline failure keeps the cart and a retry succeeds once", async ({ page, context }) => {
  await page.goto("/en/order")
  await addBurgerWithCheese(page)
  await goToCheckout(page)
  const name = testCustomer("Offline")
  await fillCheckout(page, { name })

  await context.setOffline(true)
  await page.getByTestId("place-order").click()
  await expect(page.getByText(/No connection/)).toBeVisible()
  await expect(page).toHaveURL(/\/en\/order\/checkout$/)

  await context.setOffline(false)
  await page.getByTestId("place-order").click()
  await page.waitForURL(/\/en\/track\//)
  expect(await ordersFor(name)).toHaveLength(1)
})

test("@desktop the menu stays usable on a slow 3G connection", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP network throttling is Chromium-only")
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Network.enable")
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  })
  test.setTimeout(180_000)
  await page.goto("/en/order", { timeout: 90_000 })
  // Server-rendered menu is readable before JavaScript arrives…
  await expect(page.locator('[data-item="classic-beef-burger"]')).toBeVisible({ timeout: 30_000 })
  // …and becomes interactive once hydrated.
  await expect(page.locator('[data-menu-ready="true"]')).toBeAttached({ timeout: 120_000 })

  await addBurgerWithCheese(page)
  await goToCheckout(page)
  const name = testCustomer("Slow")
  await fillCheckout(page, { name })
  await page.getByTestId("place-order").click()
  await expect(page.getByTestId("place-order")).toBeDisabled()
  await page.waitForURL(/\/en\/track\//, { timeout: 90_000 })
  expect(await ordersFor(name)).toHaveLength(1)
})

test("@desktop an unavailable item is rejected at checkout", async ({ page }) => {
  const { db } = await import("./helpers")
  await page.goto("/en/order")
  await page.locator('[data-item="soft-drink"]').click()
  await page.getByTestId("add-to-order").click()
  await goToCheckout(page)
  const name = testCustomer("SoldOut")
  await fillCheckout(page, { name })

  await db.menuItem.update({ where: { slug: "soft-drink" }, data: { isAvailable: false } })
  try {
    await page.getByTestId("place-order").click()
    await expect(page.getByText(/just sold out/)).toBeVisible()
    await expect(page).toHaveURL(/\/en\/order\/cart$/)
    expect(await ordersFor(name)).toHaveLength(0)
  } finally {
    await db.menuItem.update({ where: { slug: "soft-drink" }, data: { isAvailable: true } })
  }
})
