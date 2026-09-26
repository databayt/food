// Generate every PWA icon the manifest, the layout and the service worker name.
//
// Design: the burger (public/logo.png) sitting at ~64% of a brand-green box,
// inside the maskable safe zone, so one artwork serves iOS (which rounds the
// corners itself and renders transparency black), Android maskable icons and
// the browser tab. Ported from hogwarts scripts/gen-pwa-icons.mjs.
//   node scripts/gen-pwa-icons.mjs
import sharp from "sharp"

const GREEN = "#00bc6d" // --brand in globals.css
const GLYPH = "public/logo.png"
const BOX = 512
const GLYPH_SIZE = Math.round(BOX * 0.64)

const glyph = await sharp(GLYPH).resize(GLYPH_SIZE, GLYPH_SIZE, { fit: "inside" }).png().toBuffer()
const masterBuf = await sharp({
  create: { width: BOX, height: BOX, channels: 4, background: GREEN },
})
  .composite([{ input: glyph, gravity: "centre" }])
  .png()
  .toBuffer()

const jobs = [
  ["public/icon-512.png", 512],
  ["public/icon-192.png", 192],
  ["public/icon-96.png", 96],
  ["public/icon-72.png", 72],
  ["public/apple-touch-icon.png", 180],
  // Next file conventions: the tab icon and the apple-touch-icon <link>.
  ["src/app/icon.png", 512],
  ["src/app/apple-icon.png", 180],
]
for (const [out, size] of jobs) {
  await sharp(masterBuf).resize(size, size).flatten({ background: GREEN }).png().toFile(out)
  console.log("wrote", out, size)
}
