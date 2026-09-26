/**
 * Test staff accounts for local development and Playwright. NEVER run against
 * production. Passwords are reset on every run so e2e setup is deterministic.
 *
 *   pnpm seed:test-staff
 */
import "dotenv/config"

import bcrypt from "bcryptjs"

import { db } from "../src/lib/db"

export const TEST_STAFF = [
  { email: "cashier@test.charlesburgers.rw", name: "Test Cashier", role: "CASHIER" },
  { email: "kitchen@test.charlesburgers.rw", name: "Test Kitchen", role: "KITCHEN" },
  { email: "admin@test.charlesburgers.rw", name: "Test Admin", role: "ADMIN" },
] as const

export const TEST_STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD ?? "test-staff-password"

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed test staff in production")
  const passwordHash = await bcrypt.hash(TEST_STAFF_PASSWORD, 10)
  for (const s of TEST_STAFF) {
    await db.user.upsert({
      where: { email: s.email },
      update: { passwordHash, role: s.role, isActive: true },
      create: { ...s, passwordHash },
    })
  }
  console.log(`✓ ${TEST_STAFF.length} test staff accounts ready`)
}

if (process.argv[1]?.includes("seed-test-staff")) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => db.$disconnect())
}
