/**
 * Create the first ADMIN from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (.env).
 * Idempotent: an existing account is left untouched.
 *
 *   pnpm seed:admin
 */
import "dotenv/config"

import bcrypt from "bcryptjs"

import { db } from "../src/lib/db"

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!email || !password || password.length < 10) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (10+ chars) in .env")
  }
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`= admin ${email} already exists`)
    return
  }
  await db.user.create({
    data: { email, name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  })
  console.log(`✓ admin ${email} created`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
