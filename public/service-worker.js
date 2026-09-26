// Charles Burgers service worker — the hand-rolled house shape (hogwarts
// public/service-worker.js, without its signed-in page saving: nothing here
// keeps an order, a staff screen or an API body on the phone).
//
//   - Precache: the three locale-explicit offline pages + the build chunks
//     their HTML references, so the fallback renders styled and hydrated.
//     Never the bare "/offline" — it is a 307, and a stored redirect is
//     refused for a navigation.
//   - /_next/static: cache-first (hashed, immutable).
//   - Menu photos, /_next/image and icons: stale-while-revalidate, capped.
//   - Navigations: network-only, the locale's offline page on failure.
//   - RSC fetches: network-only, a 503 on failure so the router falls back to
//     a full navigation (which lands on the offline page).
//   - /api/ and every non-GET: untouched.
//
// Bump VERSION on every change to this file.
const VERSION = "v2";
const SHELL = `cb-shell-${VERSION}`;
const STATIC = `cb-static-${VERSION}`;
const MEDIA = `cb-media-${VERSION}`;
const MEDIA_CAP = 150;
const LOCALES = ["en", "rw", "ar"];
const DEFAULT_LOCALE = "en";
const OFFLINE = LOCALES.map((l) => `/${l}/offline`);
const ICONS = ["/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // credentials: "omit" — the proxy writes NEXT_LOCALE on every locale
      // page, so fetching all three with cookies would leave the visitor's
      // language on whichever answered last. redirect: "manual" — a redirect
      // fails the install loudly instead of storing a response navigations refuse.
      await cache.addAll(
        [...OFFLINE, ...ICONS].map(
          (url) => new Request(url, { credentials: "omit", redirect: "manual" }),
        ),
      );
      // Best effort: the chunks and styles the offline pages load.
      const assets = new Set();
      for (const url of OFFLINE) {
        const res = await cache.match(url);
        const html = res ? await res.text() : "";
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g))
          assets.add(m[0]);
      }
      const statics = await caches.open(STATIC);
      await Promise.all(
        [...assets].map((url) => statics.add(url).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, STATIC, MEDIA]);
      for (const key of await caches.keys()) {
        if (!keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

function offlineFor(pathname) {
  const seg = pathname.split("/")[1];
  const lang = LOCALES.includes(seg) ? seg : DEFAULT_LOCALE;
  return caches.match(`/${lang}/offline`);
}

async function trim(cacheName, cap) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - cap; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(STATIC);
    cache.put(request, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(request);
  const refresh = fetch(request).then(async (res) => {
    if (res.ok) {
      await cache.put(request, res.clone());
      await trim(MEDIA, MEDIA_CAP);
    }
    return res;
  });
  if (hit) {
    event.waitUntil(refresh.catch(() => undefined));
    return hit;
  }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        async () => (await offlineFor(url.pathname)) ?? Response.error(),
      ),
    );
    return;
  }

  if (request.headers.get("RSC") === "1") {
    event.respondWith(
      fetch(request).catch(() => new Response("", { status: 503 })),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/items/") ||
    /\.(png|jpe?g|webp|avif|svg|ico)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
