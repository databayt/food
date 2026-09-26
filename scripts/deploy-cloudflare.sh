#!/usr/bin/env bash
# Charles Burgers (food) → Cloudflare Containers. Ported from mkan's
# scripts/deploy-cloudflare.sh: builds the Next standalone server on the Mac,
# wraps it in a COPY-only linux/amd64 image, smokes it locally, deploys it
# behind the Worker in cf/worker.js.
#
#   scripts/deploy-cloudflare.sh <env-file> build|smoke|deploy|all
#
# <env-file>  dotenv with the PRODUCTION values (scripts/cf-keychain-env.sh > file).
#             NEXT_PUBLIC_* are inlined by next build; non-secret vars are baked into
#             the image as env.json; secrets go to the Worker via scripts/cf-secrets.sh.
# build       copy the source, install (incl. linux/x64 binaries), next build (standalone),
#             assemble the image dir. The local .env is NEVER copied: dev secrets must
#             not reach the image, and nothing at build time touches the database.
# smoke       docker build (linux/amd64) + run on :3300, curl it, stop
# deploy      wrangler deploy from the build dir (builds + pushes the image)
#
# CF_SOURCE=<ref>|head|worktree  what to build (default head).
# CF_BUILD_DIR, CF_HEAP_MB (3072), NEXT_BUILD_CPUS (2).
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=${1:?dotenv with production values}; MODE=${2:-all}
ENV_FILE=$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")
BUILD_DIR=${CF_BUILD_DIR:-${TMPDIR:-/tmp}/food-cf-build}
IMAGE=food-cf:local

build() {
  local SOURCE=${CF_SOURCE:-head}
  rm -rf "$BUILD_DIR"; mkdir -p "$BUILD_DIR"
  if [[ "$SOURCE" == "worktree" ]]; then
    echo "==> copying the WORKING TREE ($(git rev-parse --short HEAD) + uncommitted changes) to $BUILD_DIR"
    rsync -a --exclude node_modules --exclude .next --exclude .git --exclude coverage \
      --exclude playwright-report --exclude test-results --exclude playwright --exclude '.env' --exclude '.env.*' \
      ./ "$BUILD_DIR/"
  else
    local REF=$SOURCE; [[ "$REF" == "head" ]] && REF=HEAD
    echo "==> exporting $REF ($(git rev-parse --short "$REF")) to $BUILD_DIR"
    git archive "$REF" | tar -x -C "$BUILD_DIR"
  fi
  cd "$BUILD_DIR"

  echo "==> installing for darwin + linux/x64 (sharp, swc binaries for the image)"
  node -e '
    const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));
    p.pnpm={...(p.pnpm||{}),supportedArchitectures:{os:["current","linux"],cpu:["current","x64"],libc:["current","glibc"]}};
    fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'
  pnpm install --frozen-lockfile --prefer-offline --silent --ignore-scripts
  node scripts/fetch-thmanyah.mjs >/dev/null   # fonts are fetch-only (license)

  echo "==> prisma generate"
  pnpm exec prisma generate >/dev/null

  echo "==> i18n gate"
  pnpm i18n:check >/dev/null

  echo "==> next build (standalone) with $ENV_FILE"
  export CF_CONTAINER=1 NODE_OPTIONS="--max-old-space-size=${CF_HEAP_MB:-3072}" NEXT_TELEMETRY_DISABLED=1 NEXT_BUILD_CPUS=${NEXT_BUILD_CPUS:-2}
  node cf/env-split.mjs "$ENV_FILE" run -- pnpm exec next build
  [[ -f .next/standalone/server.js ]] || { echo "ABORT: .next/standalone/server.js missing"; exit 1; }
  if ls -a .next/standalone | grep -qE '^\.env'; then echo "ABORT: a .env file reached the standalone output"; exit 1; fi

  echo "==> assembling: baked non-secret config"
  node cf/env-split.mjs "$ENV_FILE" config > .next/standalone/env.json
  echo "    env.json: $(node -e 'console.log(Object.keys(require("./.next/standalone/env.json")).length)') config vars; $(node cf/env-split.mjs "$ENV_FILE" secrets | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Object.keys(JSON.parse(s)).length))') secrets stay with the Worker"
  du -sh .next/standalone .next/static public | sed 's/^/    /'
}

smoke() {
  cd "$BUILD_DIR"
  echo "==> docker build (linux/amd64, COPY-only)"
  docker build --platform linux/amd64 -f Dockerfile.cf -t "$IMAGE" . 2>&1 | tail -3
  local DENV; DENV=$(mktemp -t food-smoke.XXXXXX); trap 'rm -f "$DENV"' RETURN
  node cf/env-split.mjs "$ENV_FILE" docker > "$DENV"
  [[ -n "${SMOKE_DATABASE_URL:-}" ]] && printf 'DATABASE_URL=%s\nDIRECT_URL=%s\n' "$SMOKE_DATABASE_URL" "$SMOKE_DATABASE_URL" >> "$DENV"
  docker rm -f food-cf-smoke >/dev/null 2>&1 || true
  echo "==> docker run :3300 (DATABASE_URL host: $(grep -E '^DATABASE_URL=' "$DENV" | tail -1 | sed -E 's#.*@([^/:]+).*#\1#'))"
  docker run -d --rm --name food-cf-smoke --platform linux/amd64 -p 3300:3000 --env-file "$DENV" "$IMAGE" >/dev/null
  local i
  for i in $(seq 1 90); do curl -sf -o /dev/null http://localhost:3300/api/health && break; sleep 2; done
  echo "    boot: ${i}×2s"
  for p in /api/health / /en/order /rw/order /ar/order /en/order/cart /en/login /en/cashier /en/track/AAAAAAAAAAAAAAAAAAAAAA /robots.txt; do
    printf "    %-34s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url} %{time_total}s' -H 'Host: bu.databayt.org' -H 'X-Forwarded-Proto: https' "http://localhost:3300$p")"
  done
  echo "==> container log tail"; docker logs --tail 15 food-cf-smoke 2>&1 | sed 's/^/    /'
  docker stop food-cf-smoke >/dev/null
}

deploy() {
  cd "$BUILD_DIR"
  echo "==> wrangler deploy (builds + pushes the image)"
  pnpm exec wrangler deploy
}

case "$MODE" in
  build) build ;;
  smoke) smoke ;;
  deploy) deploy ;;
  all) build; smoke; deploy ;;
  *) echo "mode must be build|smoke|deploy|all"; exit 2 ;;
esac
echo "==> done ($MODE)"
