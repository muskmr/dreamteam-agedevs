# Deploy: Podman single container + host Ollama

Option **C**: one image / one container for API+web. Ollama stays on the host.

```
┌─────────────────────────────────────────────────────────────┐
│  HOST (bare metal: macOS / Linux)                           │
│                                                             │
│  ┌──────────────┐     ┌───────────────────────────────────┐ │
│  │ Podman       │     │ Ollama (on host, NOT in container)│ │
│  │              │     │  ollama serve                     │ │
│  │  podman build│     │  model: llama3.2                  │ │
│  │  podman run  │     │  port :11434                      │ │
│  └──────┬───────┘     └─────────────▲─────────────────────┘ │
│         │                             │                     │
│         ▼                             │ OLLAMA_URL          │
│  ┌────────────────────────────────────┴──────────────────┐  │
│  │  ONE CONTAINER  dreamteam-app                         │  │
│  │  (image built from ./Containerfile in this repo)      │  │
│  │                                                       │  │
│  │     • API  (Express, :3001)                           │  │
│  │     • WEB  (Vite,   :5173)                            │  │
│  │                                                       │  │
│  │   volume:  ./projects  →  /app/projects               │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                    publish -p WEB_PORT:5173                 │
└──────────────────────────────┼──────────────────────────────┘
                               ▼
                         Browser → http://127.0.0.1:5173
```

## Flow

1. `npm run podman:up` → platform + Podman audit  
2. If Podman missing → Problem/Solution/Commands → re-run  
3. `podman build -t localhost/dreamteam-app:latest -f Containerfile .`  
4. `podman run` with `OLLAMA_URL=http://host.containers.internal:11434`, `projects/` volume, published ports  
5. Script prints Web URL  
6. Host Ollama optional at start; UI shows **Ollama disconnected** with install hints until `ollama serve` + model pull  

## Commands

```bash
npm run podman:up
npm run podman:down
```

Env overrides: `WEB_PORT`, `API_PORT`, `OLLAMA_PORT`, `OLLAMA_MODEL`, `DREAMTEAM_IMAGE`, `DREAMTEAM_CONTAINER`.
