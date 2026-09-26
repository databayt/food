/**
 * Next.js 16 Proxy (formerly "middleware"). Ported from mkan `src/proxy.ts`.
 *   1. Origin/Host check on state-changing requests (CSRF defense in depth).
 *   2. Enforce a locale prefix on page routes (cookie → Accept-Language → en).
 *   3. Cookie-presence gate on staff routes. Role checks happen in layouts and
 *      server actions — the proxy never decodes the JWT.
 *   4. Security headers (CSP enforced in production, report-only in dev).
 */
import { NextRequest, NextResponse } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

import { i18n } from "@/components/internationalization/config";
import { apiAuthPrefix, protectedPrefixes } from "@/routes";

const locales: readonly string[] = i18n.locales;
const isProduction = process.env.NODE_ENV === "production";

function isAuthenticated(request: NextRequest): boolean {
  const cookieName = isProduction
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  return !!request.cookies.get(cookieName)?.value;
}

function localeOf(pathname: string): string | undefined {
  return locales.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
}

function stripLocale(pathname: string, locale: string): string {
  const rest = pathname.slice(locale.length + 1);
  return rest === "" ? "/" : rest;
}

function isProtectedRoute(path: string): boolean {
  return protectedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function isOriginMismatch(request: NextRequest): boolean {
  if (
    !["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())
  )
    return false;
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;

  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  try {
    const originHost = new URL(origin).host;
    return (
      originHost !== host &&
      !extra.includes(originHost) &&
      !extra.includes(origin)
    );
  } catch {
    return true;
  }
}

function buildCsp(isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    // static.cloudflareinsights.com: the zone's Web Analytics beacon, injected at the edge.
    isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com"
      : "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.amazonaws.com https://cloudflareinsights.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

function withSecurityHeaders(
  response: NextResponse,
  requestId: string,
  persistLocale?: string,
) {
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
    response.headers.set("Content-Security-Policy", buildCsp(false));
  } else {
    response.headers.set("Content-Security-Policy-Report-Only", buildCsp(true));
  }
  // Only set the cookie when it changes, so steady-state pages stay cacheable.
  if (persistLocale) {
    response.cookies.set("NEXT_LOCALE", persistLocale, {
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    });
  }
  return response;
}

function negotiateLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && locales.includes(cookieLocale)) return cookieLocale;
  const languages = new Negotiator({
    headers: {
      "accept-language": request.headers.get("accept-language") ?? "",
    },
  }).languages();
  try {
    return match(languages, locales, i18n.defaultLocale);
  } catch {
    return i18n.defaultLocale;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.set("x-request-id", requestId);
  const passThrough = () =>
    NextResponse.next({ request: { headers: forwardHeaders } });

  if (!pathname.startsWith(apiAuthPrefix) && isOriginMismatch(request)) {
    return new NextResponse("Forbidden: cross-origin request blocked", {
      status: 403,
      headers: { "X-Request-Id": requestId },
    });
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return passThrough();
  }

  const urlLocale = localeOf(pathname);
  if (!urlLocale) {
    const locale = negotiateLocale(request);
    const url = request.nextUrl.clone();
    // "/" is the QR target: land straight on the menu (one redirect, not two).
    url.pathname =
      pathname === "/" ? `/${locale}/order` : `/${locale}${pathname}`;
    return withSecurityHeaders(NextResponse.redirect(url), requestId, locale);
  }

  const persistLocale =
    request.cookies.get("NEXT_LOCALE")?.value === urlLocale
      ? undefined
      : urlLocale;
  const path = stripLocale(pathname, urlLocale);

  if (isProtectedRoute(path) && !isAuthenticated(request)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${urlLocale}/login`;
    url.search = `?callbackUrl=${encodeURIComponent(pathname)}`;
    return withSecurityHeaders(
      NextResponse.redirect(url),
      requestId,
      persistLocale,
    );
  }

  return withSecurityHeaders(passThrough(), requestId, persistLocale);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
