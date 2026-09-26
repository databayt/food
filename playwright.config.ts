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
