import type { NextConfig } from "next"

const cdnDomain = process.env.NEXT_PUBLIC_CDN_DOMAIN?.trim()

// Cloudflare Containers lane (scripts/deploy-cloudflare.sh): the standalone
// server runs in a container, so it needs output: "standalone" (mkan).
const CF_CONTAINER = process.env.CF_CONTAINER === "1"

const nextConfig: NextConfig = {
  reactCompiler: true,
  ...(CF_CONTAINER ? { output: "standalone" as const } : {}),
  // Prisma + the Neon/pg driver stack must stay external to the server bundle.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-neon", "@prisma/adapter-pg", "@neondatabase/serverless", "pg", "ws"],
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
  async headers() {
    // The proxy skips /api, so API responses get their static headers here (mkan).
    return [
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
