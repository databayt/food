import { beforeEach, describe, expect, it, vi } from "vitest"

import { MENU, SETTINGS } from "../helpers/menu-fixtures"

// ---- mocks ---------------------------------------------------------------
const state = vi.hoisted(() => ({
  committed: [] as Array<[string, unknown]>,
  failOrderCreate: false as false | "unique" | "boom",
  existingByKey: new Map<string, { number: number; publicToken: string }>(),
  settings: null as Record<string, unknown> | null,
  menu: [] as unknown[],
  rateLimited: false,
}))

vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string
    meta?: unknown
    constructor(message: string, { code, meta }: { code: string; meta?: unknown }) {
      super(message)
      this.code = code
      this.meta = meta
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } }
})

vi.mock("@/lib/rate-limit", () => {
  class RateLimitError extends Error {
    constructor(public retryAfter: number) {
      super("RATE_LIMITED")
    }
  }
  return {
    RateLimitError,
    getClientId: vi.fn(async () => "127.0.0.1"),
    assertRateLimit: vi.fn(async () => {
      if (state.rateLimited) throw new RateLimitError(30)
    }),
  }
})

vi.mock("@/lib/db", async () => {
  const { Prisma } = await import("@prisma/client")
  let seq = 1000
  const db = {
    restaurant: { findUnique: vi.fn(async () => state.settings) },
    menuItem: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        (state.menu as Array<{ id: string }>).filter((i) => where.id.in.includes(i.id))
      ),
    },
    order: {
      findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) => state.existingByKey.get(where.idempotencyKey) ?? null),
    },
    // Fake interactive transaction: writes are staged and only "commit" if
    // the callback resolves — a throw anywhere leaves nothing behind.
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const staged: Array<[string, unknown]> = []
      const tx = {
        customer: {
          upsert: vi.fn(async (args: unknown) => {
            staged.push(["customer.upsert", args])
            return { id: "cust-1" }
          }),
        },
        order: {
          create: vi.fn(async (args: { data: { idempotencyKey: string; publicToken: string } }) => {
            if (state.failOrderCreate === "boom") throw new Error("connection reset")
            if (state.failOrderCreate === "unique") {
              // Another request committed the same key between fast path and insert.
              state.existingByKey.set(args.data.idempotencyKey, { number: 1500, publicToken: "winner-token-aaaaaaaaaa" })
              throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test", meta: { target: ["idempotencyKey"] } })
            }
            staged.push(["order.create", args])
            seq += 1
            return { number: seq, publicToken: args.data.publicToken }
          }),
        },
      }
      const result = await cb(tx)
      state.committed.push(...staged)
      return result
    }),
  }
  return { db }
})

import { createOrder } from "@/components/order/checkout/actions"
import { db } from "@/lib/db"

// ---- helpers ---------------------------------------------------------------
const KEY = "5b0c3a7e-8d2f-4a61-9f3c-2e7b1d4c9a10"

function input(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: KEY,
    locale: "en",
    name: "Aline Uwase",
    phone: "078 123 4567",
    fulfillment: "PICKUP",
    address: "",
    paymentMethod: "CASH",
    note: "",
    lines: [{ itemId: "i-classic", optionIds: ["o-cheese"], quantity: 2, note: "no onions" }],
    ...overrides,
  }
}

type CreateArgs = {
  data: {
    subtotal: number
    deliveryFee: number
    total: number
    customerPhone: string
    deliveryAddress: string | null
    items: { create: Array<{ unitPrice: number; lineTotal: number; names: Record<string, string>; modifiers: { create: Array<{ price: number }> } }> }
    payment: { create: { method: string; status: string; amount: number } }
    history: { create: { to: string } }
  }
}

function committedOrder(): CreateArgs["data"] {
  const entry = state.committed.find(([k]) => k === "order.create")
  if (!entry) throw new Error("no order committed")
  return (entry[1] as CreateArgs).data
}

beforeEach(() => {
  vi.clearAllMocks()
  state.committed = []
  state.failOrderCreate = false
  state.existingByKey = new Map()
  state.settings = { ...SETTINGS }
  state.menu = structuredClone(MENU)
  state.rateLimited = false
})

// ---- tests -----------------------------------------------------------------
describe("createOrder — server-side totals", () => {
  it("prices every line from the database", async () => {
    const res = await createOrder(input())
    expect(res).toMatchObject({ success: true, data: { number: 1001 } })
    const order = committedOrder()
    // (3000 + 500 cheese) × 2
    expect(order.subtotal).toBe(7000)
    expect(order.deliveryFee).toBe(0)
    expect(order.total).toBe(7000)
    expect(order.items.create[0]).toMatchObject({ unitPrice: 3000, lineTotal: 7000 })
    expect(order.items.create[0]!.modifiers.create[0]!.price).toBe(500)
  })

  it("ignores manipulated client prices and totals", async () => {
    const res = await createOrder(
      input({
        total: 1,
        subtotal: 1,
        lines: [{ itemId: "i-classic", optionIds: ["o-cheese"], quantity: 2, note: "", price: 1, unitPrice: 1, lineTotal: 1 }],
      })
    )
    expect(res.success).toBe(true)
    expect(committedOrder().total).toBe(7000)
  })

  it("adds the delivery fee only for delivery", async () => {
    await createOrder(input({ fulfillment: "DELIVERY", address: "KG 11 Ave, near the market" }))
    const order = committedOrder()
    expect(order.deliveryFee).toBe(1000)
    expect(order.total).toBe(8000)
    expect(order.deliveryAddress).toBe("KG 11 Ave, near the market")
  })

  it("snapshots localized names for every locale", async () => {
    await createOrder(input())
    expect(committedOrder().items.create[0]!.names).toEqual({
      en: "Classic Beef Burger",
      rw: "Classic Beef Burger", // falls back to English
      ar: "Classic Beef Burger (ar)",
    })
  })

  it("stores the phone in E.164", async () => {
    await createOrder(input())
    expect(committedOrder().customerPhone).toBe("+250781234567")
  })
})

describe("createOrder — rejections", () => {
  it("rejects an unavailable item", async () => {
    const res = await createOrder(input({ lines: [{ itemId: "i-soldout", optionIds: [], quantity: 1, note: "" }] }))
    expect(res).toMatchObject({ success: false, error: "ITEM_UNAVAILABLE", details: { itemIds: ["i-soldout"] } })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("rejects archived and unknown items", async () => {
    const res = await createOrder(
      input({
        lines: [
          { itemId: "i-archived", optionIds: [], quantity: 1, note: "" },
          { itemId: "i-missing", optionIds: [], quantity: 1, note: "" },
        ],
      })
    )
    expect(res).toMatchObject({ success: false, error: "ITEM_UNAVAILABLE" })
  })

  it.each([
    ["an option from another item", ["o-fanta"]],
    ["a sold-out option", ["o-fries"]],
    ["a duplicated option", ["o-cheese", "o-cheese"]],
    ["too many options (max 2)", ["o-cheese", "o-sauce", "o-fries"]],
    ["an unknown option", ["o-nope"]],
  ])("rejects %s", async (_label, optionIds) => {
    const res = await createOrder(input({ lines: [{ itemId: "i-classic", optionIds, quantity: 1, note: "" }] }))
    expect(res).toMatchObject({ success: false, error: "INVALID_MODIFIER" })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("rejects a missing required choice (min 1)", async () => {
    const res = await createOrder(input({ lines: [{ itemId: "i-drink", optionIds: [], quantity: 1, note: "" }] }))
    expect(res).toMatchObject({ success: false, error: "INVALID_MODIFIER" })
  })

  it("rejects an empty cart", async () => {
    const res = await createOrder(input({ lines: [] }))
    expect(res).toMatchObject({ success: false, error: "EMPTY_CART" })
  })

  it("rejects delivery without an address", async () => {
    const res = await createOrder(input({ fulfillment: "DELIVERY", address: "" }))
    expect(res).toMatchObject({ success: false, error: "VALIDATION", errors: { address: "ADDRESS_REQUIRED" } })
  })

  it("accepts pickup without an address and never stores one", async () => {
    const res = await createOrder(input({ fulfillment: "PICKUP", address: "should be dropped" }))
    expect(res.success).toBe(true)
    expect(committedOrder().deliveryAddress).toBeNull()
  })

  it("rejects an invalid phone number", async () => {
    const res = await createOrder(input({ phone: "12345" }))
    expect(res).toMatchObject({ success: false, errors: { phone: "PHONE_INVALID" } })
  })

  it("rejects when the restaurant is closed", async () => {
    state.settings = { ...SETTINGS, isOpen: false }
    expect(await createOrder(input())).toMatchObject({ success: false, error: "RESTAURANT_CLOSED" })
  })

  it("rejects a disabled fulfillment type or payment method", async () => {
    state.settings = { ...SETTINGS, deliveryEnabled: false, momoEnabled: false }
    expect(await createOrder(input({ fulfillment: "DELIVERY", address: "Somewhere 12" }))).toMatchObject({
      error: "FULFILLMENT_DISABLED",
    })
    expect(await createOrder(input({ paymentMethod: "MOMO" }))).toMatchObject({ error: "PAYMENT_METHOD_DISABLED" })
  })

  it("rejects quantities outside 1–20", async () => {
    const res = await createOrder(input({ lines: [{ itemId: "i-classic", optionIds: [], quantity: 21, note: "" }] }))
    expect(res).toMatchObject({ success: false, error: "VALIDATION" })
  })

  it("returns RATE_LIMITED when over budget", async () => {
    state.rateLimited = true
    expect(await createOrder(input())).toMatchObject({ success: false, error: "RATE_LIMITED" })
  })
})

describe("createOrder — idempotency", () => {
  it("returns the existing order for a repeated key without writing", async () => {
    const first = await createOrder(input())
    expect(first.success).toBe(true)
    if (!first.success) return
    state.existingByKey.set(KEY, { number: first.data.number, publicToken: first.data.token })

    const second = await createOrder(input())
    expect(second).toEqual(first)
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(state.committed.filter(([k]) => k === "order.create")).toHaveLength(1)
  })

  it("resolves a race on the unique key to the winner's order", async () => {
    state.failOrderCreate = "unique"
    const res = await createOrder(input())
    expect(res).toEqual({ success: true, data: { number: 1500, token: "winner-token-aaaaaaaaaa" } })
    expect(state.committed).toHaveLength(0)
  })
})

describe("createOrder — atomicity", () => {
  it("creates customer, order, item snapshots, modifiers, payment and history in ONE transaction", async () => {
    await createOrder(input({ paymentMethod: "MOMO" }))
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(state.committed.map(([k]) => k)).toEqual(["customer.upsert", "order.create"])
    const order = committedOrder()
    expect(order.items.create).toHaveLength(1)
    expect(order.payment.create).toEqual({ method: "MOMO", status: "PENDING", amount: 7000 })
    expect(order.history.create).toMatchObject({ to: "NEW" })
  })

  it("leaves nothing behind when the transaction fails", async () => {
    state.failOrderCreate = "boom"
    const res = await createOrder(input())
    expect(res).toMatchObject({ success: false, error: "GENERIC" })
    expect(state.committed).toEqual([])
  })
})
