import { describe, expect, it } from "vitest"

import { riderMessage, shareOnWhatsApp } from "@/components/cashier/rider-message"
import type { CashierOrder } from "@/components/cashier/types"
import en from "@/components/internationalization/en.json"

const ORDER: CashierOrder = {
  id: "o1",
  number: 1042,
  status: "READY",
  fulfillment: "DELIVERY",
  createdAt: "2026-09-26T10:00:00.000Z",
  customerName: "Aline Uwase",
  customerPhone: "+250781234567",
  deliveryAddress: "KG 11 Ave, blue gate after the pharmacy",
  deliveryLat: -1.9441,
  deliveryLng: 30.0619,
  deliveryAccuracy: 20,
  dispatchedAt: null,
  note: "Call on arrival",
  total: 8000,
  cancelReason: null,
  payment: { method: "CASH", status: "PENDING", reference: null },
  items: [
    { id: "a", name: "Classic Beef Burger", quantity: 2, modifiers: ["Cheese Extra"], note: null },
    { id: "b", name: "Fanta", quantity: 1, modifiers: [], note: null },
  ],
}

const opts = { restaurant: "Charles Burgers", methodLabel: "Cash" }

describe("riderMessage", () => {
  it("carries who, where, what and how much to collect", () => {
    expect(riderMessage(ORDER, en.cashier.rider, opts)).toBe(
      [
        "Charles Burgers — delivery #1042",
        "Customer: Aline Uwase",
        "Phone: 078 123 4567",
        "Address: KG 11 Ave, blue gate after the pharmacy",
        "Map: https://www.google.com/maps/search/?api=1&query=-1.944100,30.061900",
        "",
        "Items:",
        "2× Classic Beef Burger (+ Cheese Extra)",
        "1× Fanta",
        "Note: Call on arrival",
        "",
        "Collect: 8,000 RWF (Cash)",
      ].join("\n")
    )
  })

  it("tells the rider to collect nothing once paid, and skips a missing pin", () => {
    const text = riderMessage(
      { ...ORDER, deliveryLat: null, deliveryLng: null, note: null, payment: { method: "MOMO", status: "PAID", reference: "MP1" } },
      en.cashier.rider,
      opts
    )
    expect(text).not.toContain("Map:")
    expect(text).not.toContain("Note:")
    expect(text.endsWith("Paid — collect nothing.")).toBe(true)
  })

  it("shares through WhatsApp's chat picker", () => {
    expect(shareOnWhatsApp("a b&c")).toBe("https://wa.me/?text=a%20b%26c")
  })
})
