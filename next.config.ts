import path from "node:path"

import type { NextConfig } from "next"

const cdnDomain = process.env.NEXT_PUBLIC_CDN_DOMAIN?.trim()

// Cloudflare Workers lane (scripts/deploy-cloudflare.sh sets CF_WORKERS=1): OpenNext bundles
// the server into one Worker, so Prisma/pg stay bundled and the optimizer is off.
const CF_WORKERS = Boolean(process.env.CF_WORKERS)

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Locally the Neon/pg driver stack stays external to the server bundle; on Workers it must be
  // bundled (no node_modules at runtime).
  ...(CF_WORKERS ? {} : { serverExternalPackages: ["@prisma/adapter-neon", "@prisma/adapter-pg", "@neondatabase/serverless", "pg", "ws"] }),
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
      allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    },
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  images: {
    // The /_next/image optimizer would need Cloudflare Images (paid) on Workers: serve originals.
    ...(CF_WORKERS ? { unoptimized: true } : {}),
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 750, 828, 1080, 1280],
    imageSizes: [64, 80, 96, 128, 256],
    qualities: [65, 75],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      ...(cdnDomain ? [{ protocol: "https" as const, hostname: cdnDomain }] : []),
    ],
  },
  // Workers can't compile WebAssembly from bytes, so Prisma's workerd runtime imports its query
  // compiler as `./query_compiler_fast_bg.wasm?module`. Keep that a runtime import with an
  // absolute path so OpenNext marks it external and wrangler uploads the .wasm as a module.
  ...(CF_WORKERS
    ? {
        webpack: (config: { externals?: unknown }, { isServer }: { isServer: boolean }) => {
          if (!isServer) return config
          const existing = config.externals ? (Array.isArray(config.externals) ? config.externals : [config.externals]) : []
          config.externals = [
            ...existing,
            ({ request, context }: { request?: string; context?: string }, callback: (err?: Error | null, result?: string) => void) => {
              if (request?.endsWith(".wasm?module") && context) {
                const file = path.resolve(context, request.slice(0, -"?module".length))
                return callback(null, `import ${file}?module`)
              }
              callback()
            },
          ]
          return config
        },
      }
    : {}),
  async headers() {
    // The proxy skips /api, so API responses get their static headers here (mkan).
    return [
      {
        // Browsers check for a new worker on every navigation; never let an
        // HTTP cache hand back the old one.
        source: "/service-worker.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

export default nextConfig
