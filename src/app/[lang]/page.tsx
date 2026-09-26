import { redirect } from "next/navigation"

// The QR target is the menu itself: /{lang} → /{lang}/order.
export default async function LocaleHome({ params }: PageProps<"/[lang]">) {
  const { lang } = await params
  redirect(`/${lang}/order`)
}
