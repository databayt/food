#!/usr/bin/env bash
# Charles Burgers (food, bu.databayt.org) → Cloudflare Workers via OpenNext. No container: the
# $0-incremental lane on the Workers Paid plan (same recipe as databayt/space and databayt/co).
#
#   scripts/deploy-cloudflare.sh <env-file> build|preview|deploy|all
#
# <env-file>  production dotenv (0600, outside the repo): scripts/cf-keychain-env.sh > file.
#             Needed AT BUILD TIME too (NEXT_PUBLIC_* are inlined). Durable copies of each secret
#             live in the macOS Keychain as cf-food-<VAR>.
# build       export HEAD (or $CF_DEPLOY_REF) to a throwaway dir, switch nothing but that copy, OpenNext build
# preview     run the real Worker locally in workerd against the real database
# deploy      push secrets, populate the ISR cache, deploy
#
# CF_WORKER_NAME=food-next  deploy a TRIAL Worker instead: different name, no routes, workers_dev only,
#                           no AUTH_URL/NEXTAUTH_URL (the request URL is right on Workers).
# CF_BUILD_DIR, CF_HEAP_MB (4096), CF_DEPLOY_REF.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=${1:?production dotenv}; MODE=${2:-all}
ENV_FILE=$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")
# Not $TMPDIR: macOS purges /var/folders overnight and silently guts node_modules.
BUILD_DIR=${CF_BUILD_DIR:-$HOME/.cache/cf-build/food-next}
REF=${CF_DEPLOY_REF:-HEAD}
MAX_GZIP_KB=${MAX_GZIP_KB:-10240}
# Set in wrangler.jsonc "vars" — never pushed as secrets (a secret can't shadow a var).
NOT_SECRET='^(CF_WORKERS|NEXT_PUBLIC_APP_URL|NEXTAUTH_URL|AUTH_URL|AUTH_TRUST_HOST|ALLOWED_ORIGINS|DATABASE_URL_ADAPTER|VERCEL|TURBO_|NX_)'

load_env() {
  while IFS= read -r line; do
    [[ "$line" =~ ^([A-Z0-9_]+)=(.*)$ ]] || continue
    local k="${BASH_REMATCH[1]}" v="${BASH_REMATCH[2]}"
    v="${v%\"}"; v="${v#\"}"
    [[ -z "$v" ]] && continue
    export "$k=$v"
  done < "$ENV_FILE"
}

build() {
  rm -rf "$BUILD_DIR"; mkdir -p "$BUILD_DIR"
  echo "==> exporting $REF ($(git rev-parse --short "$REF")) to $BUILD_DIR"
  git archive "$REF" | tar -x -C "$BUILD_DIR"
  cd "$BUILD_DIR"
  load_env
  export CF_WORKERS=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--max-old-space-size=${CF_HEAP_MB:-4096}"

  echo "==> switching the Prisma generator to runtime = \"workerd\" (this copy only)"
  python3 - <<'PY'
import pathlib, re
p = pathlib.Path('prisma/schema.prisma'); s = p.read_text()
if 'runtime' not in s.split('generator client',1)[1].split('}',1)[0]:
    s = re.sub(r'(generator client \{[^}]*?provider\s*=\s*"prisma-client")', r'\1\n  runtime  = "workerd"', s, count=1)
    p.write_text(s)
print('    ' + [l for l in s.splitlines() if 'runtime' in l][0].strip())
PY

  if [[ -n "${CF_WORKER_NAME:-}" && "$CF_WORKER_NAME" != "food" ]]; then
    echo "==> trial Worker '$CF_WORKER_NAME': no routes, no AUTH_URL, own self-reference"
    node -e '
      const fs=require("fs"); const name=process.argv[1];
      const txt=fs.readFileSync("wrangler.jsonc","utf8").split("\n").filter(l=>!/^\s*\/\//.test(l)).join("\n");
      const c=JSON.parse(txt);
      c.name=name; delete c.routes;
      c.vars.ALLOWED_ORIGINS=process.env.TRIAL_ORIGINS||""; delete c.vars.AUTH_URL; delete c.vars.NEXTAUTH_URL;
      c.services=[{binding:"WORKER_SELF_REFERENCE",service:name}];
      c.migrations=[{tag:"v2",new_sqlite_classes:["DOShardedTagCache"]}];
      fs.writeFileSync("wrangler.jsonc",JSON.stringify(c,null,2));
    ' "$CF_WORKER_NAME"
  fi

  echo "==> fonts (fetch-only, license) + installing (postinstall: prisma generate, now for workerd)"
  node scripts/fetch-thmanyah.mjs >/dev/null
  pnpm install --frozen-lockfile --prefer-offline --silent

  echo "==> i18n gate"
  pnpm i18n:check >/dev/null

  echo "==> opennextjs-cloudflare build"
  pnpm exec opennextjs-cloudflare build
  [[ -f .open-next/worker.js ]] || { echo "ABORT: .open-next/worker.js missing"; exit 1; }

  echo "==> bundle size vs the ${MAX_GZIP_KB} KB Workers Paid limit"
  local out; out=$(pnpm exec wrangler deploy --dry-run 2>&1 || true)
  echo "$out" | grep -iE 'Total Upload' | sed 's/^/    /'
  local gz; gz=$(echo "$out" | grep -oE 'gzip: [0-9.]+ [KM]iB' | head -1 | awk '{v=$2; if($3=="MiB") v=v*1024; printf "%d", v}')
  if [[ -n "$gz" ]] && (( gz > MAX_GZIP_KB )); then
    echo "ABORT: bundle is ${gz} KB gzip, over the ${MAX_GZIP_KB} KB limit. Not deploying."; exit 1
  fi
  echo "    ok: ${gz:-?} KB gzip"
}

secrets_json() {
  node -e '
    const fs=require("fs"); const o={}; const skip=new RegExp(process.argv[2]);
    for (const l of fs.readFileSync(process.argv[1],"utf8").split("\n")) {
      const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(!m||skip.test(m[1])) continue;
      let v=m[2].trim(); if(v.startsWith("\"")&&v.endsWith("\"")) v=v.slice(1,-1);
      if(v) o[m[1]]=v;
    }
    process.stdout.write(JSON.stringify(o));
  ' "$ENV_FILE" "$NOT_SECRET"
}

preview() {
  cd "$BUILD_DIR"
  secrets_json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);require("fs").writeFileSync(".dev.vars",Object.entries(o).map(([k,v])=>k+"="+JSON.stringify(v)).join("\n")+"\n",{mode:0o600})})'
  trap 'rm -f "$BUILD_DIR/.dev.vars"' EXIT
  echo "==> preview on :8788 (real workerd, real database). Ctrl-C to stop."
  pnpm exec opennextjs-cloudflare preview --port 8788
}

deploy() {
  cd "$BUILD_DIR"
  echo "==> pushing secrets ($(secrets_json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Object.keys(JSON.parse(s)).join(", ")))'))"
  secrets_json | pnpm exec wrangler secret bulk
  echo "==> opennextjs-cloudflare deploy (populates the KV cache, then wrangler deploy)"
  pnpm exec opennextjs-cloudflare deploy
}

case "$MODE" in
  build) build ;;
  preview) preview ;;
  deploy) deploy ;;
  all) build; deploy ;;
  *) echo "mode must be build|preview|deploy|all"; exit 2 ;;
esac
echo "==> done ($MODE)"
