import path from "node:path";
import { defineConfig } from "@prisma/config";
import "dotenv/config";

// Multi-file schema (hogwarts pattern): prisma/schema.prisma holds the
// generator + datasource, prisma/models/*.prisma hold the domain models.
// Migrations run over the direct (non-pooled) Neon endpoint when available.
export default defineConfig({
  schema: path.join("prisma"),
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
  migrations: {
    path: path.join("prisma", "migrations"),
  },
});
