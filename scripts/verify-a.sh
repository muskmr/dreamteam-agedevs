#!/usr/bin/env bash
# Verification gate A: build + API smoke + Web UI smoke (no live LLM required).
# Exit 0 on success. Used before commit / before asking to start B.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

info() { printf '==> %s\n' "$*"; }
ok() { printf '    OK  %s\n' "$*"; }
fail() { printf '    FAIL  %s\n' "$*" >&2; exit 1; }

API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"
API_BASE="http://127.0.0.1:${API_PORT}"
WEB_BASE="http://127.0.0.1:${WEB_PORT}"

STARTED_API=0
STARTED_WEB=0
API_PID=""
WEB_PID=""

cleanup() {
  if [[ "$STARTED_WEB" -eq 1 && -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
    wait "$WEB_PID" 2>/dev/null || true
  fi
  if [[ "$STARTED_API" -eq 1 && -n "${API_PID:-}" ]]; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

info "[1/5] Build API"
npm run build -w packages/api
ok "packages/api tsc"

info "[2/5] Build web"
npm run build -w packages/web
ok "packages/web build"

info "[3/5] Start API for smoke"
fuser -k "${API_PORT}/tcp" >/dev/null 2>&1 || true
if [[ -f packages/api/dist/index.js ]]; then
  (cd packages/api && PORT="$API_PORT" HOST_OS_LABEL="verify-a" node dist/index.js) >/tmp/dreamteam-verify-api.log 2>&1 &
else
  (cd packages/api && PORT="$API_PORT" HOST_OS_LABEL="verify-a" npx tsx src/index.ts) >/tmp/dreamteam-verify-api.log 2>&1 &
fi
API_PID=$!
STARTED_API=1

for i in $(seq 1 40); do
  if curl -sf "$API_BASE/api/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    cat /tmp/dreamteam-verify-api.log >&2 || true
    fail "API process exited during startup"
  fi
  sleep 0.5
done

HEALTH="$(curl -sf "$API_BASE/api/health" || true)"
[[ -n "$HEALTH" ]] || fail "GET /api/health did not respond"
echo "$HEALTH" | grep -q '"status":"ok"' || fail "health missing status ok: $HEALTH"
echo "$HEALTH" | grep -q '"hostOs"' || fail "health missing hostOs: $HEALTH"
ok "GET /api/health → $HEALTH"

info "[4/5] Start Web UI (Vite) for smoke"
fuser -k "${WEB_PORT}/tcp" >/dev/null 2>&1 || true
(
  cd packages/web
  API_URL="$API_BASE" WEB_PORT="$WEB_PORT" npx vite --host 127.0.0.1 --port "$WEB_PORT"
) >/tmp/dreamteam-verify-web.log 2>&1 &
WEB_PID=$!
STARTED_WEB=1

for i in $(seq 1 60); do
  if curl -sf "$WEB_BASE/" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    cat /tmp/dreamteam-verify-web.log >&2 || true
    fail "Vite process exited during startup"
  fi
  sleep 0.5
done

HTML="$(curl -sf "$WEB_BASE/" || true)"
[[ -n "$HTML" ]] || fail "GET $WEB_BASE/ did not respond"
echo "$HTML" | grep -qi 'root\|DREAMTEAM\|vite' || fail "web HTML unexpected: ${HTML:0:200}"
ok "GET $WEB_BASE/ → HTML ($(wc -c <<<"$HTML") bytes)"

PROXY_HEALTH="$(curl -sf "$WEB_BASE/api/health" || true)"
[[ -n "$PROXY_HEALTH" ]] || fail "Vite proxy GET /api/health failed"
echo "$PROXY_HEALTH" | grep -q '"status":"ok"' || fail "proxied health bad: $PROXY_HEALTH"
ok "GET $WEB_BASE/api/health (via Vite proxy) → $PROXY_HEALTH"

info "[5/5] Create project smoke + script syntax"
NAME="VerifyA-$(date +%s)"
CREATE="$(curl -sf -X POST "$API_BASE/api/projects" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"$NAME\"}" || true)"
[[ -n "$CREATE" ]] || fail "POST /api/projects failed"
echo "$CREATE" | grep -q "$NAME" || fail "create response missing name: $CREATE"
ok "POST /api/projects → $NAME"

LIST="$(curl -sf "$API_BASE/api/projects" || true)"
echo "$LIST" | grep -q "$NAME" || fail "project not listed: $LIST"
ok "GET /api/projects lists $NAME"

bash -n scripts/podman-up.sh
bash -n scripts/podman-down.sh
ok "podman scripts bash -n"

info "A verification SUCCESS (API + Web UI)"
printf 'VERIFY_A_RESULT=SUCCESS\n'
printf 'WEB_UI=%s\n' "$WEB_BASE"
