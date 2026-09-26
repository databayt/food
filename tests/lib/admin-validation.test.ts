import { describe, expect, it } from "vitest"

import { ItemSchema } from "@/components/admin/menu/validation"
import { splitTranslations, translationsSchema } from "@/components/admin/validation"

const names = (en: string, rw = "", ar = "") => ({ en: { name: en }, rw: { name: rw }, ar: { name: ar } })

describe("admin translations", () => {
  it("requires English, which every other locale falls back to", () => {
    expect(translationsSchema().safeParse(names("")).success).toBe(false)
    expect(translationsSchema().safeParse(names("Burgers")).success).toBe(true)
  })

  it("upserts filled locales and deletes empty ones", () => {
    const parsed = translationsSchema().parse(names("Burgers", "", "برغر"))
    expect(splitTranslations(parsed)).toEqual({
      upserts: [
        { locale: "en", name: "Burgers", description: null },
        { locale: "ar", name: "برغر", description: null },
      ],
      deletes: ["rw"],
    })
  })
})

describe("menu item validation", () => {
  const base = {
    slug: "classic-beef-burger",
    categoryId: "c1",
    price: "3000",
    imageUrl: "",
    sortOrder: "10",
    isAvailable: true,
    isNew: false,
    groupIds: [],
    translations: { en: { name: "Classic Beef Burger", description: "" }, rw: { name: "", description: "" }, ar: { name: "", description: "" } },
  }

  it("accepts whole francs", () => {
    expect(ItemSchema.parse(base).price).toBe(3000)
  })

  it.each(["3000.5", "-1", "abc"])("rejects price %s", (price) => {
    expect(ItemSchema.safeParse({ ...base, price }).success).toBe(false)
  })

  it.each(["Classic Burger", "UPPER", "a", "trailing-"])("rejects slug %s", (slug) => {
    expect(ItemSchema.safeParse({ ...base, slug }).success).toBe(false)
  })

  it("rejects non-https image URLs", () => {
    expect(ItemSchema.safeParse({ ...base, imageUrl: "javascript:alert(1)" }).success).toBe(false)
    expect(ItemSchema.safeParse({ ...base, imageUrl: "http://x.com/a.jpg" }).success).toBe(false)
    expect(ItemSchema.safeParse({ ...base, imageUrl: "https://cdn.example.com/a.webp" }).success).toBe(true)
  })
})
