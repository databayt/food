import "dotenv/config"

import { defineConfig, devices } from "@playwright/test"

/**
 * E2E against the dev server + the Neon dev branch. Test orders use customer
 * names starting with "E2E " and are removed in global teardown.
 *
 *   pnpm test:e2e
 *
 * Projects: desktop Chrome (full suite incl. staff flows), Pixel 7 Chrome and
 * iPhone 13 Safari (customer flows), and an Arabic RTL phone project.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000"

// Every test starts with the install sheet already dismissed — it opens over
// the menu on a phone's first visit and would swallow the first click.
// tests/e2e/pwa.spec.ts clears this to cover the sheet itself.
const installSheetDismissed = {
  cookies: [],
  origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: "pwa-install-dismissed-at", value: String(Date.now()) }] }],
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
    storageState: installSheetDismissed,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /rtl\.spec/ },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, grepInvert: /@desktop/, testIgnore: /rtl\.spec/ },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] }, grepInvert: /@desktop/, testIgnore: /rtl\.spec/ },
    { name: "ar-mobile", use: { ...devices["Pixel 7"], locale: "ar" }, testMatch: /rtl\.spec/ },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : { command: "pnpm dev", url: `${baseURL}/en/order`, reuseExistingServer: true, timeout: 180_000 },
})
