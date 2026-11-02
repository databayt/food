import { expect, test } from "@playwright/test"

import { TEST_PASSWORD, TEST_STAFF } from "./global-setup"

/**
 * Before the page hydrates (a slow counter phone, a fast Enter), the browser
 * submits the form itself. That must POST the body to /api/staff-login —
 * never fall back to a GET that puts the password in the URL.
 */
test("@desktop signing in before hydration never puts the password in a URL", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const urls: string[] = []
  page.on("request", (r) => urls.push(r.url()))

  await page.goto("/en/login")
  await page.locator("#email").fill(TEST_STAFF.cashier.email)
  await page.locator("#password").fill("not-the-password")
  await page.locator("#password").press("Enter")
  await expect(page).toHaveURL(/\/en\/login\?error=INVALID_CREDENTIALS$/)
  await expect(page.locator('form p[role="alert"]')).toHaveText("Wrong email or password.")

  await page.locator("#email").fill(TEST_STAFF.cashier.email)
  await page.locator("#password").fill(TEST_PASSWORD)
  await page.locator("#password").press("Enter")
  await expect(page).toHaveURL(/\/en\/cashier$/)

  expect(urls.filter((u) => u.includes("password"))).toEqual([])
  await context.close()
})
