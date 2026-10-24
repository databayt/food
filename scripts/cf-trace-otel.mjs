// Runs after `next build` for the Cloudflare Workers build (see open-next.config.ts).
//
// Next traces only the CommonJS build of @opentelemetry/api (build/src) for the Node.js
// middleware, but OpenNext bundles the middleware with esbuild using the `module` field,
// which points at build/esm. Add the ESM files to the trace, and to .next/standalone
// (OpenNext copies traced files from there), so the middleware's copy is complete.
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const nftPath = ".next/server/middleware.js.nft.json";
const pkgDir = "node_modules/@opentelemetry/api";
if (!existsSync(nftPath) || !existsSync(pkgDir)) process.exit(0);

const nft = JSON.parse(readFileSync(nftPath, "utf8"));
const files = new Set(nft.files);
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.add(path.relative(".next/server", full));
  }
}
walk(path.join(pkgDir, "build/esm"));
const standalone = path.join(".next/standalone", pkgDir, "build/esm");
if (existsSync(".next/standalone")) cpSync(path.join(pkgDir, "build/esm"), standalone, { recursive: true });
nft.files = [...files];
writeFileSync(nftPath, JSON.stringify(nft));
console.log("cf-trace-otel: added @opentelemetry/api ESM build to the middleware trace");
