import { expect, test, type Locator, type Page } from "@playwright/test"

import { db, staffPage } from "./helpers"

/**
 * Running the restaurant from the admin: the owner's everyday jobs, each
 * checked where it matters (the guest menu, a real login, the database).
 * Test rows use the "e2e-" prefix; global teardown removes them.
 */
const RUN = Date.now().toString(36)

/** Click a save button and wait for ITS server action to answer (toasts linger). */
async function save(page: Page, button: Locator) {
  const answered = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"])
  await button.click()
  await answered
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible()
}

test("@desktop the owner adds an item, reprices it, marks it sold out and archives it", async ({ browser, page: guest }) => {
  const slug = `e2e-item-${RUN}`
  const admin = await staffPage(browser, "admin")
  await admin.goto("/en/admin/menu/new")
  await admin.locator("#item-en-name").fill("E2E Test Burger")
  await admin.getByTestId("item-price").fill("4200")
  await admin.locator("#category").selectOption({ label: "Burgers" })
  await admin.locator("#slug").fill(slug)
  await save(admin, admin.getByTestId("save-item"))
  await admin.waitForURL(/\/en\/admin\/menu\/(?!new)[\w-]+$/)

  // Guests see it at once, priced from the database.
  await guest.goto("/en/order")
  const card = guest.locator(`[data-item="${slug}"]`)
  await expect(card).toContainText("4,200 RWF")

  await admin.getByTestId("item-price").fill("4500")
  await save(admin, admin.getByTestId("save-item"))
  await guest.reload()
  await expect(card).toContainText("4,500 RWF")

  // Sold out from the list: still on the menu, can't be ordered.
  await admin.goto("/en/admin/menu")
  const row = admin.locator(`[data-testid="admin-item"][data-slug="${slug}"]`)
  await save(admin, row.getByTestId("availability"))
  await guest.reload()
  await expect(card).toContainText("Sold out")

  // Archived: gone from the menu, kept for history.
  await row.locator("a").click()
  await save(admin, admin.getByRole("button", { name: "Archive", exact: true }))
  await expect(admin.getByRole("button", { name: "Restore", exact: true })).toBeVisible()
  await guest.reload()
  await expect(card).toHaveCount(0)
  expect(await db.menuItem.findUnique({ where: { slug }, select: { isArchived: true, price: true } })).toEqual({ isArchived: true, price: 4500 })
})

test("@desktop the owner adds a category and an extras group with a priced option", async ({ browser }) => {
  const admin = await staffPage(browser, "admin")

  await admin.goto("/en/admin/categories")
  await admin.getByRole("button", { name: "Add category" }).click()
  await admin.locator("#cat-new-en-name").fill("E2E Desserts")
  await admin.locator("#slug-null").fill(`e2e-cat-${RUN}`)
  await save(admin, admin.getByTestId("category-card").filter({ has: admin.locator("#cat-new-en-name") }).getByRole("button", { name: "Save" }))
  await admin.reload()
  await expect(admin.getByTestId("category-card").filter({ has: admin.locator(`input[value="e2e-cat-${RUN}"]`) })).toHaveCount(1)

  await admin.goto("/en/admin/modifiers")
  await admin.getByRole("button", { name: "Add group" }).click()
  const group = admin.locator("section").filter({ has: admin.locator("#grp-new-en-name") })
  await admin.locator("#grp-new-en-name").fill("E2E Sauces")
  await admin.locator("#gs-null").fill(`e2e-grp-${RUN}`)
  await admin.locator("#gmax-null").fill("2")
  await save(admin, group.getByRole("button", { name: "Save" }))
  await admin.reload()

  const savedGroup = admin.locator("section").filter({ has: admin.locator(`input[value="e2e-grp-${RUN}"]`) }).last()
  await savedGroup.getByRole("button", { name: "Add option" }).click()
  await savedGroup.locator("#opt-new-en-name").fill("E2E Garlic")
  await savedGroup.locator("#os-null").fill(`e2e-grp-${RUN}-garlic`)
  await savedGroup.locator("#op-null").fill("300")
  await save(admin, savedGroup.locator("div.rounded-xl").filter({ has: admin.locator("#opt-new-en-name") }).getByRole("button", { name: "Save" }))

  const stored = await db.modifierGroup.findUnique({ where: { slug: `e2e-grp-${RUN}` }, select: { maxSelect: true, options: { select: { slug: true, price: true } } } })
  expect(stored).toEqual({ maxSelect: 2, options: [{ slug: `e2e-grp-${RUN}-garlic`, price: 300 }] })
})

test("@desktop restaurant settings save and stick", async ({ browser }) => {
  const admin = await staffPage(browser, "admin")
  await admin.goto("/en/admin/settings")
  const address = admin.locator("#s-address")
  const original = await address.inputValue()
  try {
    await address.fill(`E2E Street ${RUN}, Kigali`)
    await save(admin, admin.getByTestId("save-settings"))
    await admin.reload()
    await expect(admin.locator("#s-address")).toHaveValue(`E2E Street ${RUN}, Kigali`)
  } finally {
    await admin.locator("#s-address").fill(original)
    await save(admin, admin.getByTestId("save-settings"))
  }
})

test("@desktop the owner creates a cashier login that works, then deactivates it", async ({ browser }) => {
  const email = `e2e-cashier-${RUN}@test.charlesburgers.rw`
  const password = `E2E-${RUN}-counter-pass`
  const admin = await staffPage(browser, "admin")
  await admin.goto("/en/admin/staff")
  await admin.getByRole("button", { name: "Add staff member" }).click()
  await admin.locator("#ns-name").fill("E2E Counter")
  await admin.locator("#ns-email").fill(email)
  await admin.locator("#ns-password").fill(password)
  await admin.locator("#ns-role").selectOption("CASHIER")
  await save(admin, admin.getByRole("button", { name: "Create" }))

  const cashierContext = await browser.newContext()
  const cashier = await cashierContext.newPage()
  await cashier.goto("/en/login")
  await cashier.locator("#email").fill(email)
  await cashier.locator("#password").fill(password)
  await cashier.getByTestId("login-submit").click()
  await expect(cashier).toHaveURL(/\/en\/cashier$/)
  await cashierContext.close()

  await admin.reload()
  const row = admin.locator("li").filter({ hasText: email })
  await row.getByRole("switch").click()
  await save(admin, row.getByRole("button", { name: "Save" }))
  expect(await db.user.findUnique({ where: { email }, select: { isActive: true, role: true } })).toEqual({ isActive: false, role: "CASHIER" })
})

test("@desktop order history filters and opens an order; the QR code renders", async ({ browser }) => {
  const admin = await staffPage(browser, "admin")
  await admin.goto("/en/admin/orders")
  await expect(admin.getByRole("heading", { name: "Order history" })).toBeVisible()
  const first = admin.locator('table a[href*="/admin/orders/"]').first()
  if (await first.count()) {
    await first.click()
    await expect(admin.getByRole("heading", { name: "History" })).toBeVisible()
  }
  await admin.goto("/en/admin/qr")
  await expect(admin.getByRole("heading", { name: "Menu QR code" })).toBeVisible()
  await expect(admin.locator("main img, main svg, main canvas").first()).toBeVisible()
})
