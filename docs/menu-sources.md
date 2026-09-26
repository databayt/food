# Menu sources

Every seeded price is verified against the owner's printed-menu photographs.
The originals live outside the repo; `pnpm menu:photos` turns them into the
web assets in `public/menu/` (rotated, EXIF/GPS stripped, WebP 640/1280).

| Photo | Shows | Used as |
|---|---|---|
| `IMG_2910.jpeg` | Burger menu (portrait) | `public/menu/menu-burgers-*.webp`, price source |
| `IMG_2911.jpeg` | Meals menu (shot sideways → rotated 90°) | `public/menu/menu-meals-*.webp`, price source |
| `IMG_2909.jpeg` | Storefront sign at night | Reference only (phone number, logo) — not published |

## Items

| Category | Item | Price (RWF) | Photo |
|---|---|---:|---|
| Burgers | Classic Beef Burger | 3,000 | IMG_2910 |
| Burgers | Double Beef Burger | 4,000 | IMG_2910 |
| Burgers | Classic Chicken Burger | 3,500 | IMG_2910 |
| Burgers | Double Chicken Burger | 4,500 | IMG_2910 |
| Burgers | Special Charles Burger — "Double Beef, cheese & Souce", marked **New** | 5,500 | IMG_2910 |
| Combos | Classic Beef Burger + Fries | 5,000 | IMG_2910 |
| Combos | Double Beef Burger + Fries | 5,500 | IMG_2910 |
| Combos | Classic Chicken Burger + Fries | 5,000 | IMG_2910 |
| Combos | Double Chicken Burger + Fries | 6,000 | IMG_2910 |
| Meals | Beef Pilau | 4,000 | IMG_2911 |
| Meals | Chicken & Fries | 5,000 | IMG_2911 |
| Meals | Chicken Pilau | 5,000 | IMG_2911 |
| Extras | Cheese Extra | 500 | IMG_2910 |
| Extras | Sauce Extra (printed "Souce") | 500 | IMG_2910 |
| Extras | Fries Extra | 2,000 | IMG_2910 |
| Drinks | Fanta / Cola / Sprite | 1,200 | IMG_2910 |

## Discrepancy with the brief

The brief listed the burger/combo/extra/drink prices as "brief-sourced, not
photo-verified" and the three meals as photo-verified. With both photographs
in hand, **all 16 items are photo-verified** and every price matches the brief.

## What was *not* invented

- Descriptions are short and neutral ("Single beef patty.", "Two beef patties.")
  and editable in Admin → Menu items. Meals and extras have none.
- Item and category names are seeded in English only. Kinyarwanda and Arabic
  fall back to English until staff add translations (the admin shows a
  "Missing" badge per item).
- The Extras add-on group (Cheese +500, Sauce +500, Fries +2,000) reuses the
  printed extra prices. The drink choice (Fanta / Cola / Sprite) is a
  required single choice at the printed 1,200.

## Settings taken from the photos (confirm with the owner)

| Setting | Value | Source | Status |
|---|---|---|---|
| Phone | 079 400 0095 | menu + storefront sign | printed |
| WhatsApp | 079 400 0095 | assumed same as phone | **confirm** |
| MTN MoMo merchant code | 110009 | menu | printed |
| TikTok | @charles_burger | menu (partly cut off) | **confirm spelling** |
| Legal name | Charles Burger Resto LTD | menu footer | printed |
| Delivery fee | 0 (shown as "confirmed by the restaurant") | not printed | **owner to set** |
| Logo | text wordmark | no clean source | **owner to supply** |
