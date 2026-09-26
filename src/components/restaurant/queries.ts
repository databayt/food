import "server-only"

import { db } from "@/lib/db"

export type MenuImage = { src: string; width: number; height: number; alt: "burgers" | "meals" | string }

export type RestaurantSettings = {
  name: string
  phone: string | null
  whatsappNumber: string | null
  momoCode: string | null
  tiktok: string | null
  logoUrl: string | null
  isOpen: boolean
  pickupEnabled: boolean
  deliveryEnabled: boolean
  deliveryFee: number
  cashEnabled: boolean
  momoEnabled: boolean
  menuImages: MenuImage[]
}

const DEFAULTS: RestaurantSettings = {
  name: "Charles Burgers",
  phone: null,
  whatsappNumber: null,
  momoCode: null,
  tiktok: null,
  logoUrl: null,
  isOpen: false,
  pickupEnabled: true,
  deliveryEnabled: false,
  deliveryFee: 0,
  cashEnabled: true,
  momoEnabled: false,
  menuImages: [],
}

/** Customer-safe restaurant settings (singleton row "default"). */
export async function getRestaurant(): Promise<RestaurantSettings> {
  const row = await db.restaurant.findUnique({ where: { id: "default" } })
  if (!row) return DEFAULTS
  return {
    name: row.name,
    phone: row.phone,
    whatsappNumber: row.whatsappNumber,
    momoCode: row.momoCode,
    tiktok: row.tiktok,
    logoUrl: row.logoUrl,
    isOpen: row.isOpen,
    pickupEnabled: row.pickupEnabled,
    deliveryEnabled: row.deliveryEnabled,
    deliveryFee: row.deliveryFee,
    cashEnabled: row.cashEnabled,
    momoEnabled: row.momoEnabled,
    menuImages: Array.isArray(row.menuImages) ? (row.menuImages as MenuImage[]) : [],
  }
}
