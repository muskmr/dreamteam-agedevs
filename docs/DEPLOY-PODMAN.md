# Deploy: Podman single container + host Ollama

Option **C**: one image / one container for API+web. Ollama stays on the host.

Service endpoints use the aliases from [`env/aliases.sh`](../env/aliases.sh): `$WEB_URL`, `$API_URL`, `$OLLAMA_URL` (override via `$WEB_PORT` / `$API_PORT` / `$OLLAMA_PORT` / `$DREAMTEAM_HOST`, or set the `*_URL` vars directly).

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
```

## Flow

1. `npm run podman:up` → platform + Podman audit  
2. If Podman missing → Problem/Solution/Commands → re-run  
3. `podman build` of `$DREAMTEAM_IMAGE` from `Containerfile`  
4. `podman run` with `$OLLAMA_URL` (container→host), `projects/` volume, published `$WEB_PORT` / `$API_PORT`  
5. Script prints `$WEB_URL`  
6. Host Ollama optional at start; UI shows **Ollama disconnected** with install hints until `ollama serve` + model pull  

## Commands

```bash
npm run podman:up
npm run podman:down
```

Env overrides (names only — set values in your shell / aliases): `$WEB_PORT`, `$API_PORT`, `$OLLAMA_PORT`, `$OLLAMA_URL`, `$OLLAMA_MODEL`, `$DREAMTEAM_IMAGE`, `$DREAMTEAM_CONTAINER`.
