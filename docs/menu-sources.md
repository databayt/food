# Menu sources

Every seeded price is verified against the owner's printed-menu photographs.
The photographs are price sources only — they are not published (the menu
page opens with a brand banner instead).

| Photo           | Shows                      | Used as                       |
| --------------- | -------------------------- | ----------------------------- |
| `IMG_2910.jpeg` | Burger menu (portrait)     | price source                  |
| `IMG_2911.jpeg` | Meals menu (shot sideways) | price source                  |
| `IMG_2909.jpeg` | Storefront sign at night   | reference only (phone number) |

## Item photos and order

Order and imagery follow the Databayt Community Figma menu sheet
(`PKFu1LTety9DcCKpC6UE4t`, node `1346:7`). Photos are background-removed PNGs
(remove.bg, 500px) in `~/Downloads`, not committed; `pnpm items:photos` trims
them onto transparent squares as `public/items/<slug>.webp`, and
`pnpm items:attach` applies the photos and the sort order to a database
(never replacing a photo staff uploaded).

| #   | Item                                                       | Source                               |
| --- | ---------------------------------------------------------- | ------------------------------------ |
| 1   | Classic Beef Burger                                        | `38ede194…-removebg-preview.png`     |
| 2   | Classic Chicken Burger                                     | `63a2ae45…-removebg-preview.png`     |
| 3   | Classic Beef Burger + Fries                                | `79979129…-removebg-preview.png`     |
| 4   | Classic Chicken Burger + Fries                             | `5318839a…__1_-removebg-preview.png` |
| 5   | Double Beef Burger                                         | `f685bec1…-removebg-preview.png`     |
| 6   | Double Beef Burger + Fries                                 | `c8026c7c…-removebg-preview.png`     |
| 7   | Double Chicken Burger                                      | `image-removebg-preview-8.png`       |
| 8   | Double Chicken Burger + Fries                              | `image-removebg-preview-9.png`       |
| 9   | Special Charles Burger (+ "Special offer" badge, `22.svg`) | `image-removebg-preview-11.png`      |
| 10  | Fanta / Cola / Sprite                                      | `image-removebg-preview-5.png`       |
| 11  | Cheese Extra                                               | `image-removebg-preview-6.png`       |
| 12  | Sauce Extra                                                | `image-removebg-preview-7.png`       |
| 13  | Fries Extra                                                | `image-removebg-preview-12.png`      |
| 14  | Beef Pilau                                                 | `image-removebg-preview-13.png`      |
| 15  | Chicken & Fries                                            | `image-removebg-preview-14.png`      |
| 16  | Chicken Pilau                                              | `image-removebg-preview-15.png`      |

The three meals (from the meals menu photo) are not on the Figma sheet; they
follow at the end.

## Items

| Category | Item                                                                   | Price (RWF) | Photo    |
| -------- | ---------------------------------------------------------------------- | ----------: | -------- |
| Burgers  | Classic Beef Burger                                                    |       3,000 | IMG_2910 |
| Burgers  | Double Beef Burger                                                     |       4,000 | IMG_2910 |
| Burgers  | Classic Chicken Burger                                                 |       3,500 | IMG_2910 |
| Burgers  | Double Chicken Burger                                                  |       4,500 | IMG_2910 |
| Burgers  | Special Charles Burger — "Double Beef, cheese & Souce", marked **New** |       5,500 | IMG_2910 |
| Combos   | Classic Beef Burger + Fries                                            |       5,000 | IMG_2910 |
| Combos   | Double Beef Burger + Fries                                             |       5,500 | IMG_2910 |
| Combos   | Classic Chicken Burger + Fries                                         |       5,000 | IMG_2910 |
| Combos   | Double Chicken Burger + Fries                                          |       6,000 | IMG_2910 |
| Meals    | Beef Pilau                                                             |       4,000 | IMG_2911 |
| Meals    | Chicken & Fries                                                        |       5,000 | IMG_2911 |
| Meals    | Chicken Pilau                                                          |       5,000 | IMG_2911 |
| Extras   | Cheese Extra                                                           |         500 | IMG_2910 |
| Extras   | Sauce Extra (printed "Souce")                                          |         500 | IMG_2910 |
| Extras   | Fries Extra                                                            |       2,000 | IMG_2910 |
| Drinks   | Fanta / Cola / Sprite                                                  |       1,200 | IMG_2910 |

## Discrepancy with the brief

The brief listed the burger/combo/extra/drink prices as "brief-sourced, not
photo-verified" and the three meals as photo-verified. With both photographs
in hand, **all 16 items are photo-verified** and every price matches the brief.

## What was _not_ invented

- Descriptions are short and neutral ("Single beef patty.", "Two beef patties.")
  and editable in Admin → Menu items. Meals and extras have none.
- Item and category names are seeded in English only. Kinyarwanda and Arabic
  fall back to English until staff add translations (the admin shows a
  "Missing" badge per item).
- The Extras add-on group (Cheese +500, Sauce +500, Fries +2,000) reuses the
  printed extra prices. The drink choice (Fanta / Cola / Sprite) is a
  required single choice at the printed 1,200.

## Settings taken from the photos (confirm with the owner)

| Setting                | Value                                      | Source                 | Status               |
| ---------------------- | ------------------------------------------ | ---------------------- | -------------------- |
| Phone                  | 079 400 0095                               | menu + storefront sign | printed              |
| WhatsApp               | 079 400 0095                               | assumed same as phone  | **confirm**          |
| MTN MoMo merchant code | 110009                                     | menu                   | printed              |
| TikTok                 | @charles_burger                            | menu (partly cut off)  | **confirm spelling** |
| Legal name             | Charles Burger Resto LTD                   | menu footer            | printed              |
| Delivery fee           | 0 (shown as "confirmed by the restaurant") | not printed            | **owner to set**     |
| Logo                   | text wordmark                              | no clean source        | **owner to supply**  |
