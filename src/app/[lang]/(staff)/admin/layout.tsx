import { notFound } from "next/navigation"

import { AdminNav } from "@/components/admin/nav"
import { isLocale } from "@/components/internationalization/config"
import { requireRole } from "@/lib/auth"
import { ROUTE_ROLES } from "@/routes"

export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  await requireRole(lang, ROUTE_ROLES.admin)
  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 md:grid-cols-[200px_1fr] md:gap-8">
      <aside className="md:sticky md:top-18 md:self-start">
        <AdminNav lang={lang} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
