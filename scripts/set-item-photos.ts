/**
 * Attach the bundled item photos (public/items/<slug>.webp) to menu items that
 * have NO image yet. Never overwrites a photo staff set in the admin.
 *
 *   pnpm items:attach        # the database in DATABASE_URL
 */
import "dotenv/config"

import { db } from "../src/lib/db"
import { ITEM_PHOTOS } from "./process-item-photos"

async function main() {
  let updated = 0
  for (const slug of Object.keys(ITEM_PHOTOS)) {
    const res = await db.menuItem.updateMany({ where: { slug, imageUrl: null }, data: { imageUrl: `/items/${slug}.webp` } })
    updated += res.count
  }
  console.log(`✓ attached ${updated} photo(s); items that already had one were left alone`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
