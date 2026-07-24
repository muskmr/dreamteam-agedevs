#!/usr/bin/env bash
# Local setup for AI SDLC DREAMTEAM: npm deps + Ollama model.
# Supported: macOS, Linux. Not supported: Windows (native).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODEL="${OLLAMA_MODEL:-llama3.2}"

info() { printf '==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

info "Checking OS (macOS / Linux only)…"
uname_s="$(uname -s 2>/dev/null || true)"
case "$uname_s" in
  Darwin|Linux) ;;
  MINGW*|MSYS*|CYGWIN*)
    fail "Windows is not supported. Use macOS or Linux."
    ;;
  *)
    fail "Unsupported OS '$uname_s'. Supported: macOS, Linux. Not supported: Windows."
    ;;
esac

info "Checking Node.js / npm…"
command -v node >/dev/null 2>&1 || fail "Node.js not found. Install Node LTS from https://nodejs.org/ and re-run."
command -v npm >/dev/null 2>&1 || fail "npm not found. Install Node LTS from https://nodejs.org/ and re-run."
printf '    node %s / npm %s\n' "$(node -v)" "$(npm -v)"

info "Installing npm workspace dependencies…"
npm install

info "Checking Ollama…"
command -v ollama >/dev/null 2>&1 || fail "Ollama not found on PATH. Install from https://ollama.com then re-run: npm run setup"

if ! ollama list >/dev/null 2>&1; then
  cat >&2 <<'HINT'

ERROR: Ollama CLI is installed but the server is not reachable.
Start it in another terminal, then re-run setup:

  ollama serve

HINT
  exit 1
fi

info "Pulling model '${MODEL}' (skip if already present)…"
ollama pull "$MODEL"

cat <<NEXT

Setup complete.

Next steps (each new shell):

  source env/aliases.sh
  # ensure Ollama is running:  ollama serve
  npm run dev

Then open \$WEB_URL in a browser.
Health check:  curl "\$API_URL/api/health"

Model: ${MODEL}  (override with OLLAMA_MODEL=… before setup)
NEXT
