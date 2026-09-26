import { describe, expect, it } from "vitest"

import { formatLocalPhone, normalizeRwandaPhone, toWhatsAppDigits } from "@/lib/order/phone"
import { whatsAppHref } from "@/lib/order/whatsapp"

describe("normalizeRwandaPhone", () => {
  it.each([
    ["0794000095", "+250794000095"],
    ["079 400 0095", "+250794000095"],
    ["+250 794 000 095", "+250794000095"],
    ["250781234567", "+250781234567"],
    ["0721234567", "+250721234567"],
    ["073-123-4567", "+250731234567"],
  ])("%s → %s", (raw, e164) => {
    expect(normalizeRwandaPhone(raw)).toBe(e164)
  })

  it.each(["", "12345", "0754000095", "+254712345678", "07940000951", "abc"])("rejects %s", (raw) => {
    expect(normalizeRwandaPhone(raw)).toBeNull()
  })
})

describe("display + WhatsApp helpers", () => {
  it("formats locally", () => expect(formatLocalPhone("+250794000095")).toBe("079 400 0095"))
  it("builds wa.me digits", () => expect(toWhatsAppDigits("0794000095")).toBe("250794000095"))
  it("builds a prefilled link", () => {
    expect(whatsAppHref("+250794000095", "Order #1001")).toBe("https://wa.me/250794000095?text=Order%20%231001")
  })
  it("returns null without a valid number", () => expect(whatsAppHref(null)).toBeNull())
})
