/**
 * Menu item photos → web assets.
 *
 *   pnpm items:photos [sourceDir]     # default: ~/Downloads
 *
 * Sources are the background-removed PNG cut-outs (remove.bg previews, 500px,
 * real alpha) of the product shots supplied on 2026-09-26. Each is trimmed to
 * its subject, centred on a transparent square and written as WebP with alpha
 * to public/items/<slug>.webp. Metadata is stripped. Originals stay out of git.
 */
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

export const ITEM_PHOTOS: Record<string, string> = {
  "classic-beef-burger":
    "38ede194-9c17-4bcd-bd19-33357d8c970e-removebg-preview.png",
  "double-beef-burger":
    "f685bec1-09a4-4ea0-bbab-466c659e0ec9-removebg-preview.png",
  "classic-chicken-burger":
    "63a2ae45-2b3d-4fb9-87e2-a32128e71832-removebg-preview.png",
  "classic-beef-burger-fries":
    "79979129-26f9-425b-bc83-d6ba2c207246-removebg-preview.png",
  "double-beef-burger-fries":
    "c8026c7c-5abf-4fd9-953e-4d7b7acd938a-removebg-preview.png",
  "classic-chicken-burger-fries":
    "5318839a-d7a9-489a-9e33-0116b4fddc33__1_-removebg-preview.png",
};

const SOURCE_DIR = process.argv[2] ?? join(homedir(), "Downloads");
const OUT_DIR = join(process.cwd(), "public", "items");
const SIZE = 500;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [slug, file] of Object.entries(ITEM_PHOTOS)) {
    const trimmed = await sharp(join(SOURCE_DIR, file))
      .ensureAlpha()
      .trim({ threshold: 1 })
      .toBuffer();
    const out = join(OUT_DIR, `${slug}.webp`);
    const info = await sharp(trimmed)
      .resize(SIZE, SIZE, {
        fit: "contain",
        withoutEnlargement: false,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(out);
    console.log(
      `${slug}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`,
    );
  }
}

if (process.argv[1]?.includes("process-item-photos")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
