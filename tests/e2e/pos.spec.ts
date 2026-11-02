import { expect, test } from "@playwright/test"

import { momoSandbox, ordersFor, staffPage, testCustomer, testPhone } from "./helpers"

/** The counter POS: a ticket in a few taps, cash with change or a MoMo prompt. */
test("@desktop the counter rings up a cash walk-in straight to the kitchen", async ({ browser }) => {
  const cashier = await staffPage(browser, "cashier")
  await cashier.goto("/en/cashier/pos")
  const burger = cashier.locator('[data-pos-item="classic-beef-burger"]')
  await burger.click()
  await burger.click() // a second tap is quantity 2
  await expect(cashier.getByTestId("pos-line")).toHaveCount(1)

  const name = testCustomer("Counter")
  await cashier.getByTestId("pos-name").fill(name)
  await expect(cashier.getByTestId("pos-total")).toContainText("6,000 RWF")
  await cashier.getByTestId("pos-tendered").fill("10000")
  await expect(cashier.getByTestId("pos-change")).toContainText("4,000 RWF")
  await cashier.getByTestId("pos-charge").click()

  const done = cashier.getByTestId("pos-done")
  await expect(done).toBeVisible()
  await expect(cashier.getByTestId("pos-change-due")).toContainText("4,000 RWF")
  const number = Number(await done.getAttribute("data-number"))

  const [order] = await ordersFor(name)
  expect(order).toMatchObject({ status: "CONFIRMED", total: 6000, customerPhone: null, customerId: null })
  expect(order?.placedAt).not.toBeNull()
  expect(order?.payment).toMatchObject({ method: "CASH", status: "PAID" })

  const kitchen = await staffPage(browser, "kitchen")
  await kitchen.goto("/en/kitchen")
  await expect(kitchen.locator(`[data-testid="kitchen-order"][data-number="${number}"]`)).toBeVisible({ timeout: 20_000 })

  // Next ticket starts empty.
  await cashier.getByTestId("pos-next").click()
  await expect(cashier.getByTestId("pos-line")).toHaveCount(0)
})

test("@desktop cash short of the total cannot be charged", async ({ browser }) => {
  const cashier = await staffPage(browser, "cashier")
  await cashier.goto("/en/cashier/pos")
  await cashier.locator('[data-pos-item="classic-beef-burger"]').click()
  await cashier.getByTestId("pos-tendered").fill("1000")
  await expect(cashier.getByTestId("pos-change")).toContainText("2,000 RWF")
  await expect(cashier.getByTestId("pos-charge")).toBeDisabled()
  await cashier.getByTestId("pos-clear").click()
})

test("@desktop the counter pushes a MoMo prompt and the paid ticket lands in the kitchen", async ({ browser }) => {
  test.skip(!momoSandbox, "needs MTN MoMo sandbox keys")
  const cashier = await staffPage(browser, "cashier")
  await cashier.goto("/en/cashier/pos")
  await cashier.locator('[data-pos-item="classic-beef-burger"]').click()
  const name = testCustomer("CounterMoMo")
  await cashier.getByTestId("pos-name").fill(name)
  await cashier.getByTestId("pos-method-MOMO").click()
  await cashier.getByTestId("pos-phone").fill(testPhone())
  await expect(cashier.getByTestId("pos-charge")).toContainText("Send PIN prompt")
  await cashier.getByTestId("pos-charge").click()

  // The sandbox approves at once; the next poll places the order.
  const done = cashier.getByTestId("pos-done")
  await expect(done).toBeVisible({ timeout: 30_000 })
  await expect(done).toContainText("Paid")
  const [order] = await ordersFor(name)
  expect(order?.status).toBe("CONFIRMED")
  expect(order?.payment).toMatchObject({ method: "MOMO", status: "PAID", provider: "MTN_MOMO" })
})
