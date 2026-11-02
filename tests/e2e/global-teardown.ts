import "dotenv/config"

import { db } from "./db"

/** Remove every order and customer created by the e2e suite. */
export default async function globalTeardown() {
  const orders = await db.order.deleteMany({ where: { customerName: { startsWith: "E2E " } } })
  await db.customer.deleteMany({ where: { name: { startsWith: "E2E " }, orders: { none: {} } } })
  // admin.spec.ts rows (items before categories: a category with items can't go).
  const items = await db.menuItem.deleteMany({ where: { slug: { startsWith: "e2e-" } } })
  await db.modifierGroup.deleteMany({ where: { slug: { startsWith: "e2e-" } } })
  await db.menuCategory.deleteMany({ where: { slug: { startsWith: "e2e-" } } })
  const users = await db.user.deleteMany({ where: { email: { startsWith: "e2e-" } } })
  console.log(`[e2e] cleaned up ${orders.count} test orders, ${items.count} items, ${users.count} staff`)
  await db.$disconnect()
}
