import "dotenv/config"

import { db } from "../../src/lib/db"

/** Remove every order and customer created by the e2e suite. */
export default async function globalTeardown() {
  const orders = await db.order.deleteMany({ where: { customerName: { startsWith: "E2E " } } })
  await db.customer.deleteMany({ where: { name: { startsWith: "E2E " }, orders: { none: {} } } })
  console.log(`[e2e] cleaned up ${orders.count} test orders`)
  await db.$disconnect()
}
