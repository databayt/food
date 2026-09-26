import "dotenv/config"

import { chromium, type FullConfig } from "@playwright/test"
import bcrypt from "bcryptjs"
import { mkdirSync } from "node:fs"

import { db } from "../../src/lib/db"

export const TEST_STAFF = {
  cashier: { email: "cashier@test.charlesburgers.rw", name: "Test Cashier", role: "CASHIER" as const },
  kitchen: { email: "kitchen@test.charlesburgers.rw", name: "Test Kitchen", role: "KITCHEN" as const },
  admin: { email: "admin@test.charlesburgers.rw", name: "Test Admin", role: "ADMIN" as const },
}
export const TEST_PASSWORD = process.env.TEST_STAFF_PASSWORD ?? "test-staff-password"
export const authFile = (role: keyof typeof TEST_STAFF) => `playwright/.auth/${role}.json`

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000"

  // Deterministic staff accounts + an open restaurant with every option on.
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10)
  for (const s of Object.values(TEST_STAFF)) {
    await db.user.upsert({
      where: { email: s.email },
      update: { passwordHash, role: s.role, isActive: true },
      create: { ...s, passwordHash },
    })
  }
  await db.restaurant.update({
    where: { id: "default" },
    data: { isOpen: true, pickupEnabled: true, deliveryEnabled: true, cashEnabled: true, momoEnabled: true },
  })
  await db.menuItem.updateMany({ where: { slug: { in: ["classic-beef-burger", "soft-drink"] } }, data: { isAvailable: true, isArchived: false } })

  // Signed-in sessions, reused by staff specs.
  mkdirSync("playwright/.auth", { recursive: true })
  const browser = await chromium.launch()
  for (const role of Object.keys(TEST_STAFF) as (keyof typeof TEST_STAFF)[]) {
    const page = await browser.newPage({ baseURL })
    await page.goto("/en/login")
    await page.locator("#email").fill(TEST_STAFF[role].email)
    await page.locator("#password").fill(TEST_PASSWORD)
    await page.getByTestId("login-submit").click()
    await page.waitForURL(/\/en\/(cashier|kitchen)/, { timeout: 60_000 })
    await page.context().storageState({ path: authFile(role) })
    await page.close()
  }
  await browser.close()
  await db.$disconnect()
}
