import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { LoginForm } from "@/components/auth/login/form"
import { isLocale } from "@/components/internationalization/config"
import { getDictionary } from "@/components/internationalization/dictionaries"
import { SiteHeader } from "@/components/template/site-header"
import { HOME_BY_ROLE } from "@/routes"

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: dict.auth.title, robots: { index: false } }
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const sp = await searchParams
  const denied = sp.denied === "1"
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : undefined

  // Already signed in (and not bounced for lack of role): go to the staff home.
  const session = await auth()
  if (session?.user?.id && session.user.role && !denied) redirect(`/${lang}${HOME_BY_ROLE[session.user.role]}`)

  const dict = await getDictionary(lang)
  return (
    <>
      <SiteHeader lang={lang} />
      <main id="main-content" className="mx-auto flex max-w-sm flex-col px-4 py-12">
        <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-3xl">{dict.auth.title}</h1>
        <p className="mb-8 mt-1">{dict.auth.hint}</p>
        <LoginForm lang={lang} callbackUrl={callbackUrl} denied={denied} />
      </main>
    </>
  )
}
