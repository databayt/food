import type { Metadata } from "next"

import { BRAND_NAME, SITE_URL } from "@/lib/site"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: BRAND_NAME,
  applicationName: BRAND_NAME,
  // Installed from Safari's Add to Home Screen: open full screen under the
  // brand name. The manifest (src/app/manifest.ts) covers Android.
  appleWebApp: { capable: true, title: BRAND_NAME, statusBarStyle: "default" },
}

// Root layout is a pass-through: <html>/<body> live in [lang]/layout.tsx so
// `lang` and `dir` are set per locale (mkan pattern).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
