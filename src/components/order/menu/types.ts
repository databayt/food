export type MenuOption = {
  id: string
  name: string
  price: number
  isAvailable: boolean
}

export type MenuModifierGroup = {
  id: string
  name: string
  minSelect: number
  maxSelect: number
  options: MenuOption[]
}

export type MenuItemView = {
  id: string
  slug: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  isAvailable: boolean
  isNew: boolean
  sortOrder: number
  modifierGroups: MenuModifierGroup[]
}

export type MenuCategoryView = {
  id: string
  slug: string
  name: string
  items: MenuItemView[]
}

export type MenuView = {
  categories: MenuCategoryView[]
}
