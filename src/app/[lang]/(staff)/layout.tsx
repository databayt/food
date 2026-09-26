import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isLocale } from "@/components/internationalization/config"
import { getRestaurant } from "@/components/restaurant/queries"
import { StaffShell } from "@/components/staff/shell"
import { requireRole } from "@/lib/auth"

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Any signed-in staff member; each page narrows the roles further. */
export default async function StaffLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireRole(lang, ["ADMIN", "CASHIER", "KITCHEN"])
  const { logoUrl } = await getRestaurant()
  return (
    <StaffShell lang={lang} role={session.user.role} userName={session.user.name ?? ""} logoUrl={logoUrl}>
      {children}
    </StaffShell>
  )
}
