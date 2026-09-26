import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"

/**
 * RTL guard (ported from mkan): feature code must use logical utilities so
 * Arabic mirrors correctly. Physical margin/padding/position/text-align
 * utilities stay pinned to one side under dir="rtl".
 */
const SCAN_DIRS = [
  "src/app",
  "src/components/order",
  "src/components/track",
  "src/components/cashier",
  "src/components/kitchen",
  "src/components/admin",
  "src/components/auth",
  "src/components/template",
  "src/components/atom",
  "src/components/staff",
]

const PHYSICAL = /className=[{"`][^"`]*\b(ml-|mr-|pl-|pr-|left-|right-|text-left|text-right|rounded-l-|rounded-r-|border-l-|border-r-)/

function walk(dir: string): string[] {
  const abs = path.resolve(dir)
  if (!fs.existsSync(abs)) return []
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(rel)
    return /\.tsx?$/.test(entry.name) ? [rel] : []
  })
}

describe("RTL: feature code uses logical properties", () => {
  const files = SCAN_DIRS.flatMap(walk)

  it("scans a non-empty set of files", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${file} has no physical direction classes`, () => {
      const offenders = fs
        .readFileSync(path.resolve(file), "utf8")
        .split("\n")
        .map((line, i) => ({ n: i + 1, line: line.trim() }))
        .filter(({ line }) => PHYSICAL.test(line) && !line.includes("rtl-exempt"))
      expect(offenders, offenders.map((o) => `L${o.n}: ${o.line}`).join("\n")).toEqual([])
    })
  }
})
