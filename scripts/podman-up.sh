#!/usr/bin/env bash
# Build & run DreamTeam as ONE Podman container (API+web).
# Ollama stays on the host (bare metal). No Docker Compose required.
# Supported: macOS, Linux. Not supported: Windows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IMAGE="${DREAMTEAM_IMAGE:-localhost/dreamteam-app:latest}"
CONTAINER="${DREAMTEAM_CONTAINER:-dreamteam-app}"
WEB_PORT="${WEB_PORT:-5173}"
API_PORT="${API_PORT:-3001}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
MODEL="${OLLAMA_MODEL:-llama3.2}"

info() { printf '==> %s\n' "$*"; }
ok() { printf '    OK  %s\n' "$*"; }
bad() { printf '    MISSING  %s\n' "$*"; }

OS_FAMILY=""
OS_LABEL=""
ARCH=""
DISTRO_ID=""
HAVE_BREW=0
HAVE_PODMAN=0
PODMAN_OK=0

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
      if command -v brew >/dev/null 2>&1; then HAVE_BREW=1; fi
      ;;
    Linux)
      OS_FAMILY="linux"
      if [[ -r /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        DISTRO_ID="${ID:-unknown}"
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
    Problem:  Windows native is not supported.
    Solution: Use macOS or Linux for Podman + host Ollama.
    Commands: (none on Windows — continue on macOS or Linux)

[2] On that machine
    Commands:
      git clone <this-repo-url>
      cd shiny-robo
      git checkout <product-branch>
      npm run podman:up

────────────────────────────────────────────────────────
WIN
      exit 1
      ;;
    *)
      printf 'ERROR: Unsupported OS "%s". Use macOS or Linux.\n' "$uname_s" >&2
      exit 1
      ;;
  esac
}

audit_podman() {
  info "Platform: ${OS_LABEL}"
  info "Auditing Podman…"

  if command -v podman >/dev/null 2>&1; then
    HAVE_PODMAN=1
    ok "podman ($(command -v podman))"
    if podman info >/dev/null 2>&1; then
      PODMAN_OK=1
      ok "podman engine reachable (podman info)"
    else
      bad "podman CLI present but engine/machine not reachable"
    fi
  else
    bad "podman CLI"
  fi
}

print_podman_fix_guide() {
  local step=1
  cat <<HDR

────────────────────────────────────────────────────────
Detected: ${OS_LABEL}
Dependencies incomplete
Follow steps below in order, then run the installer again:
────────────────────────────────────────────────────────
HDR

  if [[ "$HAVE_PODMAN" -eq 0 ]]; then
    printf '\n[%d] Install Podman\n' "$step"
    printf '    Problem:  podman was not found on PATH.\n'
    printf '    Solution: Install Podman for %s.\n' "$OS_LABEL"
    printf '    Commands:\n'
    case "$OS_FAMILY" in
      macos)
        if [[ "$HAVE_BREW" -eq 1 ]]; then
          cat <<'CMD'
      brew install podman
      podman machine init
      podman machine start
CMD
        else
          cat <<'CMD'
      # Install Homebrew, then Podman:
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      brew install podman
      podman machine init
      podman machine start
CMD
        fi
        ;;
      linux)
        case "$DISTRO_ID" in
          ubuntu|debian|linuxmint|pop)
            cat <<'CMD'
      sudo apt-get update
      sudo apt-get install -y podman
CMD
            ;;
          fedora)
            cat <<'CMD'
      sudo dnf install -y podman
CMD
            ;;
          arch|manjaro)
            cat <<'CMD'
      sudo pacman -S --needed podman
CMD
            ;;
          *)
            cat <<CMD
      # Distro ${DISTRO_ID}, arch ${ARCH}: install podman via your package manager
      # https://podman.io/docs/installation
CMD
            ;;
        esac
        ;;
    esac
    printf '    Verify:\n'
    printf '      podman --version && podman info\n'
    step=$((step + 1))
  elif [[ "$PODMAN_OK" -eq 0 ]]; then
    printf '\n[%d] Start Podman engine / machine\n' "$step"
    printf '    Problem:  podman CLI works, but `podman info` failed.\n'
    printf '    Solution: Start the Podman machine (macOS) or ensure the engine is running (Linux).\n'
    printf '    Commands:\n'
    case "$OS_FAMILY" in
      macos)
        cat <<'CMD'
      podman machine init   # if not already created
      podman machine start
CMD
        ;;
      linux)
        cat <<'CMD'
      # Ensure podman can run rootless containers:
      podman info
      # If using a service:  systemctl --user enable --now podman.socket
CMD
        ;;
    esac
    printf '    Verify:\n'
    printf '      podman info\n'
    step=$((step + 1))
  fi

  cat <<END

[${step}] Re-run
    Problem:  Podman must be ready before the app image can be built.
    Solution: From the repo root:
    Commands:
      cd ${ROOT}
      npm run podman:up
    Verify:
      # script prints the Web URL when the container is up

────────────────────────────────────────────────────────
END
}

host_ollama_url() {
  # Podman DNS name for the host from inside containers
  printf 'http://host.containers.internal:%s' "$OLLAMA_PORT"
}

run_stack() {
  local ollama_url web_url
  ollama_url="$(host_ollama_url)"
  web_url="http://127.0.0.1:${WEB_PORT}"

  info "Building image ${IMAGE} (single container: API + web)…"
  podman build -t "$IMAGE" -f Containerfile .

  if podman container exists "$CONTAINER" >/dev/null 2>&1; then
    info "Removing existing container ${CONTAINER}…"
    podman rm -f "$CONTAINER" >/dev/null
  fi

  info "Starting container ${CONTAINER}…"
  # host-gateway lets host.containers.internal resolve on Linux/Mac Podman
  podman run -d \
    --name "$CONTAINER" \
    --replace \
    --add-host=host.containers.internal:host-gateway \
    -p "${WEB_PORT}:5173" \
    -p "${API_PORT}:3001" \
    -e "PORT=3001" \
    -e "API_PORT=3001" \
    -e "WEB_PORT=5173" \
    -e "API_URL=http://127.0.0.1:3001" \
    -e "OLLAMA_URL=${ollama_url}" \
    -e "OLLAMA_MODEL=${MODEL}" \
    -e "HOST_OS_LABEL=${OS_LABEL}" \
    -v "${ROOT}/projects:/app/projects:Z" \
    "$IMAGE" >/dev/null

  info "Waiting for web…"
  local i
  for i in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1 \
      || curl -sf "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  cat <<NEXT

────────────────────────────────────────────────────────
DreamTeam is up (option C: one Podman container).

  Web UI:   ${web_url}
  API:      http://127.0.0.1:${API_PORT}/api/health
  Ollama:   on the HOST at ${ollama_url}
            (install/start on the host if the UI shows disconnected)

Platform: ${OS_LABEL}
Container: ${CONTAINER}
Image:     ${IMAGE}

Stop:  npm run podman:down
────────────────────────────────────────────────────────
NEXT
}

detect_platform
audit_podman

if [[ "$HAVE_PODMAN" -eq 0 || "$PODMAN_OK" -eq 0 ]]; then
  print_podman_fix_guide
  exit 1
fi

run_stack
