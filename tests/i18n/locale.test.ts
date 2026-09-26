import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

import { i18n, isRTL, localeConfig, switchLocalePath, toLocale } from "@/components/internationalization/config"

describe("locales", () => {
  it("supports English, Kinyarwanda and Arabic with English as default", () => {
    expect(i18n.locales).toEqual(["en", "rw", "ar"])
    expect(i18n.defaultLocale).toBe("en")
  })

  it("renders Arabic RTL and English/Kinyarwanda LTR", () => {
    expect(isRTL("ar")).toBe(true)
    expect(isRTL("en")).toBe(false)
    expect(isRTL("rw")).toBe(false)
    expect(localeConfig.ar.dir).toBe("rtl")
  })

  it("falls back to the default for unknown locales", () => {
    expect(toLocale("fr")).toBe("en")
    expect(toLocale(undefined)).toBe("en")
    expect(toLocale("rw")).toBe("rw")
  })
})

describe("switchLocalePath", () => {
  it.each([
    ["/en/order", "rw", "/rw/order"],
    ["/rw/order/cart", "ar", "/ar/order/cart"],
    ["/ar", "en", "/en"],
    ["/ar/track/abc", "rw", "/rw/track/abc"],
    ["/order", "ar", "/ar/order"],
  ] as const)("%s → %s = %s", (path, target, expected) => {
    expect(switchLocalePath(path, target)).toBe(expected)
  })

  it("does not treat a word starting with a locale code as a locale", () => {
    expect(switchLocalePath("/english", "ar")).toBe("/ar/english")
  })
})

describe("dictionary parity", () => {
  const load = (l: string) =>
    JSON.parse(readFileSync(join(process.cwd(), "src/components/internationalization", `${l}.json`), "utf8"))
  const keys = (obj: unknown, prefix = ""): string[] =>
    obj && typeof obj === "object" && !Array.isArray(obj)
      ? Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
      : [prefix]

  it("every locale has exactly the English keys", () => {
    const en = keys(load("en")).sort()
    for (const l of i18n.locales) expect(keys(load(l)).sort()).toEqual(en)
  })
})
