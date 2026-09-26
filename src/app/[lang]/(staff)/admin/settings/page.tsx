import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SettingsForm } from "@/components/admin/settings/form"
import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/settings">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).admin.settings.title }
}

export default async function SettingsPage({ params }: PageProps<"/[lang]/admin/settings">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ["ADMIN"])
  const [dict, r] = await Promise.all([getDictionary(lang), db.restaurant.findUnique({ where: { id: "default" } })])
  return (
    <main id="main-content" className="space-y-4">
      <h1 className="text-2xl font-extrabold sm:text-2xl lg:text-3xl">{dict.admin.settings.title}</h1>
      <SettingsForm
        initial={{
          name: r?.name ?? "Charles Burgers",
          logoUrl: r?.logoUrl ?? "",
          phone: r?.phone ?? "",
          whatsappNumber: r?.whatsappNumber ?? "",
          momoCode: r?.momoCode ?? "",
          tiktok: r?.tiktok ?? "",
          address: r?.address ?? "",
          isOpen: r?.isOpen ?? false,
          pickupEnabled: r?.pickupEnabled ?? true,
          deliveryEnabled: r?.deliveryEnabled ?? false,
          deliveryFee: r?.deliveryFee ?? 0,
          cashEnabled: r?.cashEnabled ?? true,
          momoEnabled: r?.momoEnabled ?? false,
        }}
      />
    </main>
  )
}
