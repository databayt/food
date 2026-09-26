import type { Metadata } from "next"

import { BRAND_NAME, SITE_URL } from "@/lib/site"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: BRAND_NAME,
  applicationName: BRAND_NAME,
}

// Root layout is a pass-through: <html>/<body> live in [lang]/layout.tsx so
// `lang` and `dir` are set per locale (mkan pattern).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
