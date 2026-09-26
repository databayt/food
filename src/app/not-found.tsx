import Link from "next/link"

// Paths outside any locale that the proxy didn't catch. Minimal and
// locale-neutral: it can't know the visitor's language.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        {/* i18n-exempt-file — rendered outside [lang], before a locale exists */}
        <p style={{ fontSize: "3rem", margin: 0 }}>404</p>
        <Link href="/">Charles Burgers</Link>
      </body>
    </html>
  )
}
