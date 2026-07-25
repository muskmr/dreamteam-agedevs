# AI SDLC DREAMTEAM

Spec-first multi-agent demo: React web + Node API + **local Ollama on the host**.

**Canonical branch:** [`main`](https://github.com/muskmr/dreamteam-agedevs/tree/main).  
New work: branch from `main` as `feature/<topic>`, `fix/<topic>`, or `docs/<topic>`, then open a PR into `main`.

**License:** [MIT](LICENSE). Security reports: see [SECURITY.md](SECURITY.md).  
Repo hardening: Dependabot (npm + Actions), CodeQL code scanning, and secret scanning / push protection (enable under GitHub **Settings → Code security** if not already on).

## Supported platforms

| OS | Support |
|----|---------|
| **macOS** (Apple Silicon / Intel) | Supported |
| **Linux** (x86_64 / arm64) | Supported |
| **Windows** (native) | **Not supported** |

### CI smoke (GitHub Actions)

On every push/PR, [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs build on **Ubuntu** and smoke (mock Ollama) on **Ubuntu + macOS 14 Apple Silicon** (`macos-14`). Local gate A (`npm run verify:a`) is Cloud/Linux only.

## Recommended: Podman single container (option C)

App (API + web) runs in **one Podman container**. Ollama and the model stay on **bare metal**.

```
┌─────────────────────────────────────────────────────────────┐
│  HOST (bare metal: macOS / Linux)                           │
│                                                             │
│  ┌──────────────┐     ┌───────────────────────────────────┐ │
│  │ Podman       │     │ Ollama (on host, NOT in container)│ │
│  │              │     │  ollama serve                     │ │
│  │  podman build│     │  model: llama3.2                  │ │
│  │  podman run  │     │  $OLLAMA_URL                      │ │
│  └──────┬───────┘     └─────────────▲─────────────────────┘ │
│         │                             │                     │
│         ▼                             │ $OLLAMA_URL         │
│  ┌────────────────────────────────────┴──────────────────┐  │
│  │  ONE CONTAINER  dreamteam-app                         │  │
│  │  (image built from ./Containerfile in this repo)      │  │
│  │                                                       │  │
│  │     • API  (Express)                                  │  │
│  │     • WEB  (Vite)                                     │  │
│  │                                                       │  │
│  │   volume:  ./projects  →  /app/projects               │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│              publish via $WEB_PORT / $API_PORT              │
└──────────────────────────────┼──────────────────────────────┘
                               ▼
                         Browser → $WEB_URL
                         (UI shows Ollama connected / disconnected)
```

Service URLs and ports come from [`env/aliases.sh`](env/aliases.sh) (`$WEB_URL`, `$API_URL`, `$OLLAMA_URL`, plus `$WEB_PORT` / `$API_PORT` / `$OLLAMA_PORT`). Override those env vars before sourcing aliases or before `podman:up` — docs do not hardcode host/port literals.

### Start (Podman)

```bash
git clone <this-repo-url>
cd dreamteam-agedevs
git checkout main

npm run podman:up
```

The script detects OS/arch, audits **Podman**, prints install commands if missing, otherwise builds the image from [`Containerfile`](Containerfile), runs the container, and prints `$WEB_URL`.

- No Docker Compose required (single `podman build` + `podman run`).
- Stop: `npm run podman:down`
- If the UI shows **Ollama disconnected**, open the status chip for host-side install/`ollama serve`/`ollama pull` hints.

Same diagram: [`docs/DEPLOY-PODMAN.md`](docs/DEPLOY-PODMAN.md).

## Alternative: bare-metal Node (no Podman)

```bash
npm install
source env/aliases.sh
# ollama serve && ollama pull llama3.2
npm run dev
```

Open `$WEB_URL`. API health: `curl "$API_URL/api/health"`.

## Usage

1. **Projects** — create/select a project  
2. **Agent** — **Send** → Designer → **Approve design** / **Retry design** / **Restart design**  

Artifacts: `projects/<name>/…` (no database).

## Documentation

- [Local install (macOS)](docs/INSTALL-MAC.md)
- [Deploy (Podman option C)](docs/DEPLOY-PODMAN.md)
- [Security policy](SECURITY.md)
- [Path specification](spec/PATHS.md)
- [Orchestrator](spec/ORCHESTRATOR.md)
- [Templates](spec/TEMPLATES/)
