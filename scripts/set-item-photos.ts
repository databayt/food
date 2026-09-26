/**
 * Apply the menu design to a database: the Figma sort order (MENU_ORDER) and
 * the bundled item photos (public/items/<slug>.webp). A photo is set only when
 * the item has none or still has a bundled one — never over a photo staff
 * uploaded in the admin.
 *
 *   pnpm items:attach        # the database in DATABASE_URL
 */
import "dotenv/config"

import { db } from "../src/lib/db"
import { ITEM_PHOTOS, MENU_ORDER } from "./process-item-photos"

async function main() {
  let photos = 0
  for (const slug of Object.keys(ITEM_PHOTOS)) {
    const res = await db.menuItem.updateMany({
      where: { slug, OR: [{ imageUrl: null }, { imageUrl: { startsWith: "/items/" } }] },
      data: { imageUrl: `/items/${slug}.webp` },
    })
    photos += res.count
  }
  let ordered = 0
  for (const [index, slug] of MENU_ORDER.entries()) {
    const res = await db.menuItem.updateMany({ where: { slug }, data: { sortOrder: (index + 1) * 10 } })
    ordered += res.count
  }
  console.log(`✓ ${photos} photo(s) set, ${ordered} item(s) ordered`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
