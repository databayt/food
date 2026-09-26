import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts", "src/components/**/actions.ts", "src/components/**/resolve-order.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Next.js build-boundary guards — no-op under vitest.
      "server-only": path.resolve(import.meta.dirname, "./tests/mocks/server-only.ts"),
      "client-only": path.resolve(import.meta.dirname, "./tests/mocks/server-only.ts"),
    },
  },
})
