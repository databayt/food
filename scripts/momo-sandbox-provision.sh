#!/usr/bin/env bash
# Provision an MTN MoMo SANDBOX API user + API key from the Collections
# subscription key, store both in the Keychain, and (optionally) write the
# sandbox MOMO_* block into an env file. Sandbox only — production
# (mtnrwanda) credentials come from MTN's partner portal, never from here.
#
#   scripts/momo-sandbox-provision.sh                 # provision, store in Keychain
#   scripts/momo-sandbox-provision.sh --env .env      # …and upsert the MOMO_* block
#   scripts/momo-sandbox-provision.sh --env .env --reuse   # keep the stored user, just write env
#
# Keychain (service "databayt", account = env var name):
#   MOMO_SUBSCRIPTION_KEY  (input — the Collections primary key)
#   MOMO_API_USER, MOMO_API_KEY  (output)
# No secret is ever printed or passed in argv (headers go through process
# substitution, values into the Keychain on stdin).
set -euo pipefail

BASE="https://sandbox.momodeveloper.mtn.com"
CALLBACK_HOST="${MOMO_CALLBACK_HOST:-bu.databayt.org}"
ENV_FILE=""
REUSE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_FILE="$2"; shift 2 ;;
    --reuse) REUSE=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

kc_get() { security find-generic-password -s databayt -a "$1" -w 2>/dev/null || true; }
kc_set() { # value on stdin; `security -i` reads the command on stdin, so it never sits in argv
  local value; value=$(cat)
  value="${value//\\/\\\\}"; value="${value//\"/\\\"}"
  printf 'add-generic-password -s "databayt" -a "%s" -w "%s" -U\n' "$1" "$value" | security -i >/dev/null 2>&1
}

SUB=$(kc_get MOMO_SUBSCRIPTION_KEY)
[[ -n "$SUB" ]] || { echo "Keychain databayt/MOMO_SUBSCRIPTION_KEY missing" >&2; exit 1; }

if [[ $REUSE -eq 1 ]]; then
  API_USER=$(kc_get MOMO_API_USER)
  API_KEY=$(kc_get MOMO_API_KEY)
  [[ -n "$API_USER" && -n "$API_KEY" ]] || { echo "--reuse: no stored API user/key" >&2; exit 1; }
else
  API_USER=$(uuidgen | tr 'A-Z' 'a-z')
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/v1_0/apiuser" \
    -H @<(printf 'Ocp-Apim-Subscription-Key: %s\nX-Reference-Id: %s\nContent-Type: application/json\n' "$SUB" "$API_USER") \
    --data "{\"providerCallbackHost\":\"$CALLBACK_HOST\"}")
  [[ "$code" == "201" ]] || { echo "create api user failed: HTTP $code (wrong or inactive subscription key?)" >&2; exit 1; }

  body=$(curl -sS -w '\n%{http_code}' -X POST --data '' "$BASE/v1_0/apiuser/$API_USER/apikey" \
    -H @<(printf 'Ocp-Apim-Subscription-Key: %s\n' "$SUB"))
  code=${body##*$'\n'}
  [[ "$code" == "201" ]] || { echo "create api key failed: HTTP $code" >&2; exit 1; }
  API_KEY=$(printf %s "${body%$'\n'*}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["apiKey"])')
  [[ -n "$API_KEY" ]] || { echo "no apiKey in response" >&2; exit 1; }

  printf %s "$API_USER" | kc_set MOMO_API_USER
  printf %s "$API_KEY" | kc_set MOMO_API_KEY
fi

# Confirm the user exists and the key mints a Collection token.
info=$(curl -sS -H @<(printf 'Ocp-Apim-Subscription-Key: %s\n' "$SUB") "$BASE/v1_0/apiuser/$API_USER")
target=$(printf %s "$info" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("targetEnvironment",""), d.get("providerCallbackHost",""))')
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST --data '' "$BASE/collection/token/" \
  -H @<(printf 'Ocp-Apim-Subscription-Key: %s\nAuthorization: Basic %s\n' "$SUB" "$(printf %s "$API_USER:$API_KEY" | base64)"))
[[ "$code" == "200" ]] || { echo "collection token failed: HTTP $code" >&2; exit 1; }
echo "✓ sandbox API user ${API_USER:0:4}… (target + callback host: $target) mints a Collection token"

if [[ -n "$ENV_FILE" ]]; then
  [[ -f "$ENV_FILE" ]] || { echo "env file not found: $ENV_FILE" >&2; exit 1; }
  tmp=$(mktemp)
  grep -vE '^(# MTN MoMo sandbox|MOMO_[A-Z_]+=)' "$ENV_FILE" > "$tmp" || true
  {
    printf '# MTN MoMo sandbox (scripts/momo-sandbox-provision.sh) — test MSISDNs only, no real money\n'
    printf 'MOMO_BASE_URL=%s\n' "$BASE"
    printf 'MOMO_TARGET_ENV=sandbox\n'
    printf 'MOMO_CURRENCY=EUR\n'
    printf 'MOMO_SUBSCRIPTION_KEY=%s\n' "$SUB"
    printf 'MOMO_API_USER=%s\n' "$API_USER"
    printf 'MOMO_API_KEY=%s\n' "$API_KEY"
    printf 'MOMO_CALLBACK_URL=https://%s/api/momo/callback\n' "$CALLBACK_HOST"
  } >> "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$ENV_FILE"
  echo "✓ wrote the MOMO_* sandbox block to $ENV_FILE"
fi
