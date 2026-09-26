/**
 * One-off: turn the owner's printed-menu photographs into web-ready assets.
 *
 *   pnpm menu:photos [sourceDir]      # default: ~/Downloads
 *
 * - IMG_2910.jpeg — burger menu (portrait, upright)
 * - IMG_2911.jpeg — meals menu, shot sideways → rotated 90° counter-clockwise
 *
 * Output: public/menu/menu-{burgers,meals}-{640,1280}.webp. Metadata (EXIF,
 * GPS, ICC) is stripped — sharp drops it unless .withMetadata() is called.
 * Originals are never committed. See docs/menu-sources.md.
 */
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"

const SOURCE_DIR = process.argv[2] ?? join(homedir(), "Downloads")
const OUT_DIR = join(process.cwd(), "public", "menu")

const PHOTOS = [
  { file: "IMG_2910.jpeg", name: "menu-burgers", rotate: 0 },
  { file: "IMG_2911.jpeg", name: "menu-meals", rotate: 270 },
] as const

const WIDTHS = [640, 1280] as const

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const photo of PHOTOS) {
    for (const width of WIDTHS) {
      const out = join(OUT_DIR, `${photo.name}-${width}.webp`)
      const info = await sharp(join(SOURCE_DIR, photo.file))
        .rotate(photo.rotate)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 72, effort: 6 })
        .toFile(out)
      console.log(`${out}  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
