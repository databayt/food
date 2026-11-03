/**
 * Cache tags for display data (menu, restaurant settings). Admin writes
 * expire them at once (admin/guard.ts#revalidateAll); an order rejected
 * because an item or option changed expires the menu too, so the page the
 * guest is sent back to shows the truth.
 */
export const MENU_TAG = "menu"
export const RESTAURANT_TAG = "restaurant"
