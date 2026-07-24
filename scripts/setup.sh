#!/usr/bin/env bash
# Local setup for AI SDLC DREAMTEAM: audit deps → fix guide → npm + Ollama model.
# Supported: macOS, Linux. Not supported: Windows (native).
# No containers. Does not auto-install system packages with sudo/curl|sh —
# prints concrete commands for you to run, then asks to re-run this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODEL="${OLLAMA_MODEL:-llama3.2}"

info() { printf '==> %s\n' "$*"; }
ok() { printf '    OK  %s\n' "$*"; }
bad() { printf '    MISSING  %s\n' "$*"; }

OS_FAMILY=""
OS_LABEL=""
ARCH=""
DISTRO_ID=""
DISTRO_LIKE=""
HAVE_BREW=0
HAVE_NODE=0
HAVE_NPM=0
HAVE_OLLAMA=0
OLLAMA_UP=0

detect_platform() {
  local uname_s uname_m
  uname_s="$(uname -s 2>/dev/null || true)"
  uname_m="$(uname -m 2>/dev/null || true)"
  ARCH="$uname_m"

  case "$uname_s" in
    Darwin)
      OS_FAMILY="macos"
      case "$uname_m" in
        arm64) OS_LABEL="macOS (Apple Silicon, arm64)" ;;
        x86_64) OS_LABEL="macOS (Intel, x86_64)" ;;
        *) OS_LABEL="macOS ($uname_m)" ;;
      esac
      command -v brew >/dev/null 2>&1 && HAVE_BREW=1
      ;;
    Linux)
      OS_FAMILY="linux"
      if [[ -r /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        DISTRO_ID="${ID:-unknown}"
        DISTRO_LIKE="${ID_LIKE:-}"
        OS_LABEL="Linux (${NAME:-$DISTRO_ID}, $uname_m)"
      else
        DISTRO_ID="unknown"
        OS_LABEL="Linux ($uname_m)"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      printf 'ERROR: Windows is not supported. Use macOS or Linux.\n' >&2
      exit 1
      ;;
    *)
      printf 'ERROR: Unsupported OS "%s". Supported: macOS, Linux. Not supported: Windows.\n' "$uname_s" >&2
      exit 1
      ;;
  esac
}

audit_deps() {
  info "Platform: ${OS_LABEL}"
  info "Auditing dependencies…"

  if command -v node >/dev/null 2>&1; then
    HAVE_NODE=1
    ok "node $(node -v)"
  else
    bad "Node.js (node)"
  fi

  if command -v npm >/dev/null 2>&1; then
    HAVE_NPM=1
    ok "npm $(npm -v)"
  else
    bad "npm"
  fi

  if command -v ollama >/dev/null 2>&1; then
    HAVE_OLLAMA=1
    ok "ollama ($(command -v ollama))"
    if ollama list >/dev/null 2>&1; then
      OLLAMA_UP=1
      ok "Ollama server reachable"
    else
      bad "Ollama server not running (CLI present, daemon not reachable)"
    fi
  else
    bad "Ollama CLI (ollama)"
  fi
}

deps_ok() {
  [[ "$HAVE_NODE" -eq 1 && "$HAVE_NPM" -eq 1 && "$HAVE_OLLAMA" -eq 1 && "$OLLAMA_UP" -eq 1 ]]
}

print_fix_guide() {
  local step=1
  cat <<HDR

────────────────────────────────────────────────────────
Dependencies incomplete. Follow these steps in order,
then run the installer again:

  npm run setup

Detected: ${OS_LABEL}
────────────────────────────────────────────────────────
HDR

  if [[ "$HAVE_NODE" -eq 0 || "$HAVE_NPM" -eq 0 ]]; then
    printf '\n[%d] Install Node.js LTS (includes npm)\n' "$step"
    step=$((step + 1))
    case "$OS_FAMILY" in
      macos)
        if [[ "$HAVE_BREW" -eq 1 ]]; then
          cat <<'CMD'
    brew install node
CMD
        else
          cat <<'CMD'
    # Option A — Homebrew (recommended), then Node:
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    brew install node

    # Option B — installer from https://nodejs.org/ (LTS .pkg for your Mac CPU)
CMD
          if [[ "$ARCH" == "arm64" ]]; then
            printf '    #    choose the Apple Silicon build\n'
          else
            printf '    #    choose the x64 / Intel build\n'
          fi
        fi
        ;;
      linux)
        case "$DISTRO_ID" in
          ubuntu|debian|linuxmint|pop)
            cat <<'CMD'
    # NodeSource LTS (Ubuntu/Debian family):
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
CMD
            ;;
          fedora)
            cat <<'CMD'
    sudo dnf install -y nodejs npm
CMD
            ;;
          arch|manjaro)
            cat <<'CMD'
    sudo pacman -S --needed nodejs npm
CMD
            ;;
          opensuse*|sles)
            cat <<'CMD'
    sudo zypper install nodejs npm
CMD
            ;;
          *)
            cat <<CMD
    # Distro: ${DISTRO_ID:-unknown} (like: ${DISTRO_LIKE:-n/a})
    # Install Node LTS + npm via your package manager, nvm, or:
    #   https://nodejs.org/  (Linux ${ARCH} binaries)
    # Example with nvm:
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    # restart shell, then:
    nvm install --lts
CMD
            ;;
        esac
        ;;
    esac
    printf '    Verify:  node -v && npm -v\n'
  fi

  if [[ "$HAVE_OLLAMA" -eq 0 ]]; then
    printf '\n[%d] Install Ollama\n' "$step"
    step=$((step + 1))
    case "$OS_FAMILY" in
      macos)
        if [[ "$HAVE_BREW" -eq 1 ]]; then
          cat <<'CMD'
    brew install ollama
CMD
        else
          cat <<'CMD'
    # App from https://ollama.com/download  (macOS)
    # or after Homebrew is installed:  brew install ollama
CMD
        fi
        if [[ "$ARCH" == "arm64" ]]; then
          printf '    # Your CPU is Apple Silicon (arm64) — use the Apple Silicon build if downloading the .app\n'
        else
          printf '    # Your CPU is Intel (x86_64) — use the Intel build if downloading the .app\n'
        fi
        ;;
      linux)
        cat <<'CMD'
    curl -fsSL https://ollama.com/install.sh | sh
CMD
        printf '    # Architecture detected: %s\n' "$ARCH"
        ;;
    esac
    printf '    Verify:  command -v ollama && ollama -v\n'
  fi

  if [[ "$HAVE_OLLAMA" -eq 1 && "$OLLAMA_UP" -eq 0 ]] || [[ "$HAVE_OLLAMA" -eq 0 ]]; then
    printf '\n[%d] Start the Ollama server (leave this terminal open or run in background)\n' "$step"
    step=$((step + 1))
    case "$OS_FAMILY" in
      macos)
        cat <<'CMD'
    # If you installed the macOS app: open Ollama from Applications
    # Or from a terminal:
    ollama serve
CMD
        ;;
      linux)
        cat <<'CMD'
    ollama serve
    # Optional background:
    #   nohup ollama serve > /tmp/ollama.log 2>&1 &
CMD
        ;;
    esac
    printf '    Verify:  ollama list\n'
  fi

  cat <<END

[${step}] Re-run the installer

    cd ${ROOT}
    npm run setup

────────────────────────────────────────────────────────
END
}

run_install() {
  info "All required tools present. Continuing setup…"

  info "Installing npm workspace dependencies…"
  npm install

  info "Pulling model '${MODEL}' (no-op if already present)…"
  ollama pull "$MODEL"

  cat <<NEXT

Setup complete.

Next steps (each new shell):

  source env/aliases.sh
  # ensure Ollama is running:  ollama serve
  npm run dev

Then open \$WEB_URL in a browser.
Health check:  curl "\$API_URL/api/health"

Platform: ${OS_LABEL}
Model: ${MODEL}  (override with OLLAMA_MODEL=… before setup)
NEXT
}

detect_platform
audit_deps

if ! deps_ok; then
  print_fix_guide
  exit 1
fi

run_install
