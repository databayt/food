import { redirect } from "next/navigation"

export default async function AdminIndex({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params
  redirect(`/${lang}/admin/orders`)
}
