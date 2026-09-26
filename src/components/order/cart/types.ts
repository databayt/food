import type { MenuItemView, MenuOption } from "../menu/types"

/** What the cart stores — ids only. Names and prices come from the live menu. */
export type CartLine = {
  key: string
  itemId: string
  optionIds: string[]
  quantity: number
  note: string
}

export type ResolvedLine = {
  line: CartLine
  item: MenuItemView | null
  options: MenuOption[]
  unitPrice: number
  modifiersTotal: number
  lineTotal: number
  /** Item missing, archived, sold out, or an option no longer valid. */
  unavailable: boolean
}

/** A past order remembered on this device for tracking and "Order again". */
export type RememberedOrder = {
  token: string
  number: number
  createdAt: string
  lines: Pick<CartLine, "itemId" | "optionIds" | "quantity" | "note">[]
}
