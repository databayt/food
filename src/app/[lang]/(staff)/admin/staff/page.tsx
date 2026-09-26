import { notFound } from "next/navigation"

import { StaffContent } from "@/components/admin/staff/content"
import { isLocale } from "@/components/internationalization/config"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function StaffPage({ params }: PageProps<"/[lang]/admin/staff">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireRole(lang, ["ADMIN"])
  const staff = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  return <StaffContent staff={staff} currentUserId={session.user.id} />
}
