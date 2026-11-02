import { notFound, redirect } from "next/navigation"

import { isLocale } from "@/components/internationalization/config"

/** The cart lives on the checkout page now (one step fewer); old links land there. */
export default async function CartPage({ params }: PageProps<"/[lang]/order/cart">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  redirect(`/${lang}/order/checkout`)
}
