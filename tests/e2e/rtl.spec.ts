import { expect, test } from "@playwright/test"

test("Arabic renders right-to-left and the switcher moves to Kinyarwanda (LTR)", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/ar\/order$/) // Accept-Language: ar
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  await expect(page.locator("html")).toHaveAttribute("lang", "ar")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ماذا تشتهي اليوم؟")
  await expect(page.locator('[data-item="classic-beef-burger"]')).toContainText("3,000 RWF")

  await page.getByTestId("language-switcher").click()
  await page.getByRole("menuitem", { name: "Ikinyarwanda" }).click()
  await expect(page).toHaveURL(/\/rw\/order$/)
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
  await expect(page.locator("html")).toHaveAttribute("lang", "rw")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Urashaka kurya iki?")

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test("the Arabic checkout keeps phone input left-to-right", async ({ page }) => {
  await page.goto("/ar/order")
  await page.locator('[data-item="classic-beef-burger"]').getByTestId("quick-add").click()
  await page.getByTestId("cart-bar").click()
  await page.getByTestId("go-checkout").click()
  await expect(page.locator('input[name="phone"]')).toHaveAttribute("dir", "ltr")
  await expect(page.getByTestId("place-order")).toContainText("RWF")
})
