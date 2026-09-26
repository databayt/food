#!/usr/bin/env bash
# Print the PRODUCTION dotenv for the food Worker. food has no Vercel project,
# so the macOS Keychain is the only home for its production values:
#   secrets  → cf-food-<VAR>  (security add-generic-password -a "$USER" -s cf-food-<VAR> -w <value> -U)
#   config   → below, in git (nothing secret)
# NEVER run without redirecting stdout — it prints secrets.
#
#   scripts/cf-keychain-env.sh > "$TMPDIR/food-prod.env"
set -euo pipefail
[[ -t 1 ]] && { echo "refusing to print secrets to a terminal — redirect stdout to a file" >&2; exit 1; }

cat <<'CONFIG'
NEXT_PUBLIC_APP_URL=https://bu.databayt.org
NEXTAUTH_URL=https://bu.databayt.org
AUTH_URL=https://bu.databayt.org
AUTH_TRUST_HOST=true
ALLOWED_ORIGINS=bu.databayt.org
DATABASE_URL_ADAPTER=neon
CONFIG

for VAR in DATABASE_URL DIRECT_URL AUTH_SECRET UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN AWS_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_S3_BUCKET NEXT_PUBLIC_CDN_DOMAIN; do
  V=$(security find-generic-password -s "cf-food-$VAR" -w 2>/dev/null || true)
  if [[ -n "$V" ]]; then printf "%s=%s\n" "$VAR" "$V"; fi
done
