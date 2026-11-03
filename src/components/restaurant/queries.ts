import "server-only"

import { unstable_cache } from "next/cache"

import { RESTAURANT_TAG } from "@/lib/cache-tags"
import { db } from "@/lib/db"

export type RestaurantSettings = {
  name: string
  phone: string | null
  whatsappNumber: string | null
  momoCode: string | null
  tiktok: string | null
  address: string | null
  logoUrl: string | null
  isOpen: boolean
  pickupEnabled: boolean
  deliveryEnabled: boolean
  deliveryFee: number
  cashEnabled: boolean
  momoEnabled: boolean
}

const DEFAULTS: RestaurantSettings = {
  name: "Charles Burgers",
  phone: null,
  whatsappNumber: null,
  momoCode: null,
  tiktok: null,
  address: null,
  logoUrl: null,
  isOpen: false,
  pickupEnabled: true,
  deliveryEnabled: false,
  deliveryFee: 0,
  cashEnabled: true,
  momoEnabled: false,
}

/**
 * Customer-safe restaurant settings (singleton row "default"), cached: every
 * page reads them, and from the Workers edge each read is a round trip to
 * Frankfurt. Display only — the order actions read the row themselves.
 */
export const getRestaurant = unstable_cache(loadRestaurant, ["restaurant-settings"], { tags: [RESTAURANT_TAG], revalidate: 300 })

async function loadRestaurant(): Promise<RestaurantSettings> {
  const row = await db.restaurant.findUnique({ where: { id: "default" } })
  if (!row) return DEFAULTS
  return {
    name: row.name,
    phone: row.phone,
    whatsappNumber: row.whatsappNumber,
    momoCode: row.momoCode,
    tiktok: row.tiktok,
    address: row.address,
    logoUrl: row.logoUrl,
    isOpen: row.isOpen,
    pickupEnabled: row.pickupEnabled,
    deliveryEnabled: row.deliveryEnabled,
    deliveryFee: row.deliveryFee,
    cashEnabled: row.cashEnabled,
    momoEnabled: row.momoEnabled,
  }
}
