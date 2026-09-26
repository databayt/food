/**
 * Delivery pins. A guest may share their position at checkout; staff open it
 * in Google Maps (the app riders in Kigali already use) to find the door.
 */
export type DeliveryPin = { lat: number; lng: number; accuracy: number | null };

/** Google Maps link for a pin — opens the Maps app on phones. */
export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Google Maps search for a place by name — used for the pickup address. */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** An order's stored pin, or null when the guest didn't share one. */
export function orderPin(order: {
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAccuracy?: number | null;
}): DeliveryPin | null {
  if (order.deliveryLat == null || order.deliveryLng == null) return null;
  return {
    lat: order.deliveryLat,
    lng: order.deliveryLng,
    accuracy: order.deliveryAccuracy ?? null,
  };
}
