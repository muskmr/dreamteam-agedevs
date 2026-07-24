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
      cat <<'WIN'

────────────────────────────────────────────────────────
Detected: Windows (native)
Dependencies incomplete
Follow steps below in order, then run the installer again:
────────────────────────────────────────────────────────

[1] Move to a supported OS
    Problem:  Windows native is not supported by this installer.
    Solution: Use macOS or Linux (x86_64 or arm64). Options:
              - another machine with macOS/Linux
              - a remote Linux VM / cloud instance
              - dual-boot or a full Linux install
              (WSL2 is not a supported/tested path.)
    Commands: (none on Windows — continue on macOS or Linux)

[2] On that Mac/Linux machine, clone the repo and run setup
    Problem:  Toolchain must be installed where the app runs.
    Solution: Open a terminal on macOS or Linux in the repo root.
    Commands:
      git clone <this-repo-url>
      cd shiny-robo
      git checkout <product-branch>
      npm run setup

────────────────────────────────────────────────────────
WIN
      exit 1
      ;;
    *)
      cat <<UNK

────────────────────────────────────────────────────────
Detected: ${uname_s:-unknown} (${uname_m:-unknown})
Dependencies incomplete
Follow steps below in order, then run the installer again:
────────────────────────────────────────────────────────

[1] Switch to a supported OS
    Problem:  OS "${uname_s:-unknown}" is not supported.
    Solution: Use macOS (Apple Silicon or Intel) or Linux (x86_64 or arm64).
    Commands: (boot or open a shell on macOS/Linux, then continue there)

[2] On that machine, run the installer
    Problem:  Setup must run on a supported platform.
    Solution: From the repo root on macOS/Linux:
    Commands:
      cd <repo-root>
      npm run setup

────────────────────────────────────────────────────────
UNK
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

print_node_commands() {
  case "$OS_FAMILY" in
    macos)
      if [[ "$HAVE_BREW" -eq 1 ]]; then
        cat <<'CMD'
      brew install node
CMD
      else
        cat <<'CMD'
      # Option A — install Homebrew, then Node:
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      brew install node

      # Option B — GUI/pkg from https://nodejs.org/ (LTS)
CMD
        if [[ "$ARCH" == "arm64" ]]; then
          printf '      #           download the Apple Silicon build\n'
        else
          printf '      #           download the x64 / Intel build\n'
        fi
      fi
      ;;
    linux)
      case "$DISTRO_ID" in
        ubuntu|debian|linuxmint|pop)
          cat <<'CMD'
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
      # Distro: ${DISTRO_ID:-unknown} (like: ${DISTRO_LIKE:-n/a}), arch: ${ARCH}
      # Option A — nvm:
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
      # restart the shell, then:
      nvm install --lts

      # Option B — binaries from https://nodejs.org/ (Linux ${ARCH})
CMD
          ;;
      esac
      ;;
  esac
}

print_ollama_install_commands() {
  case "$OS_FAMILY" in
    macos)
      if [[ "$HAVE_BREW" -eq 1 ]]; then
        cat <<'CMD'
      brew install ollama
CMD
      else
        cat <<'CMD'
      # Option A — install Homebrew, then:
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      brew install ollama

      # Option B — macOS app from https://ollama.com/download
CMD
      fi
      if [[ "$ARCH" == "arm64" ]]; then
        printf '      # Your CPU is Apple Silicon (arm64) — pick the Apple Silicon build if using the .app\n'
      else
        printf '      # Your CPU is Intel (x86_64) — pick the Intel build if using the .app\n'
      fi
      ;;
    linux)
      cat <<CMD
      curl -fsSL https://ollama.com/install.sh | sh
      # Architecture detected: ${ARCH}
CMD
      ;;
  esac
}

print_ollama_serve_commands() {
  case "$OS_FAMILY" in
    macos)
      cat <<'CMD'
      # If you installed the macOS app: open Ollama from Applications
      # Or in a terminal (leave it running):
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
}

print_fix_guide() {
  local step=1

  cat <<HDR

────────────────────────────────────────────────────────
Detected: ${OS_LABEL}
Dependencies incomplete
Follow steps below in order, then run the installer again:
────────────────────────────────────────────────────────
HDR

  if [[ "$HAVE_NODE" -eq 0 || "$HAVE_NPM" -eq 0 ]]; then
    printf '\n[%d] Install Node.js LTS (includes npm)\n' "$step"
    printf '    Problem:  '
    if [[ "$HAVE_NODE" -eq 0 && "$HAVE_NPM" -eq 0 ]]; then
      printf 'node and npm were not found on PATH.\n'
    elif [[ "$HAVE_NODE" -eq 0 ]]; then
      printf 'node was not found on PATH.\n'
    else
      printf 'npm was not found on PATH.\n'
    fi
    printf '    Solution: Install Node.js LTS for %s; npm ships with it.\n' "$OS_LABEL"
    printf '    Commands:\n'
    print_node_commands
    printf '    Verify:\n'
    printf '      node -v && npm -v\n'
    step=$((step + 1))
  fi

  if [[ "$HAVE_OLLAMA" -eq 0 ]]; then
    printf '\n[%d] Install Ollama\n' "$step"
    printf '    Problem:  ollama CLI was not found on PATH.\n'
    printf '    Solution: Install Ollama for %s, then ensure `ollama` is on PATH.\n' "$OS_LABEL"
    printf '    Commands:\n'
    print_ollama_install_commands
    printf '    Verify:\n'
    printf '      command -v ollama && ollama -v\n'
    step=$((step + 1))
  fi

  if [[ "$HAVE_OLLAMA" -eq 1 && "$OLLAMA_UP" -eq 0 ]] || [[ "$HAVE_OLLAMA" -eq 0 ]]; then
    printf '\n[%d] Start the Ollama server\n' "$step"
    if [[ "$HAVE_OLLAMA" -eq 1 && "$OLLAMA_UP" -eq 0 ]]; then
      printf '    Problem:  Ollama CLI is installed, but the server did not respond to `ollama list`.\n'
    else
      printf '    Problem:  Ollama must be running before setup can pull the model.\n'
    fi
    printf '    Solution: Start the Ollama daemon and keep it running while you use the app.\n'
    printf '    Commands:\n'
    print_ollama_serve_commands
    printf '    Verify:\n'
    printf '      ollama list\n'
    step=$((step + 1))
  fi

  cat <<END

[${step}] Re-run the installer
    Problem:  Previous steps installed or started missing tools.
    Solution: From the repo root, run setup again so it can npm install and pull the model.
    Commands:
      cd ${ROOT}
      npm run setup
    Verify:
      # setup should print "Setup complete." and pull ${MODEL}

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
