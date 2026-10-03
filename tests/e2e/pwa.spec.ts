import { expect, test } from "@playwright/test"

// A fresh phone: nothing dismissed yet (playwright.config.ts seeds the
// dismissal for every other spec).
test.use({ storageState: { cookies: [], origins: [] } })

test("the install sheet waits on a first visit, opens on a return visit, stays closed once dismissed", async ({ page, context, isMobile }) => {
  test.skip(!isMobile, "the sheet is phone-only")
  // First visit: the menu shows, no sheet over it.
  await page.goto("/en/order")
  await expect(page.locator('[data-item="classic-beef-burger"]')).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // Return visit (a new session in the same browser): the sheet opens.
  const returning = await context.newPage()
  await returning.goto("/en/order")
  page = returning
  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText("Add to Home Screen")
  await expect(sheet.getByRole("button", { name: "Continue" })).toBeVisible()

  await sheet.getByRole("button", { name: "Not now" }).click()
  await expect(sheet).toBeHidden()
  await page.reload()
  await expect(page.locator('[data-item="classic-beef-burger"]')).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("the manifest and the offline pages answer", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json()
  expect(manifest.display).toBe("standalone")
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]))
  for (const url of [manifest.start_url, "/service-worker.js", "/icon-192.png", "/icon-512.png", "/en/offline", "/rw/offline", "/ar/offline"]) {
    const res = await request.get(url, { maxRedirects: 0 })
    expect(res.status(), url).toBe(200)
  }
})
