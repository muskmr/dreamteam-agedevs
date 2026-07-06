# AGENTS.md

## Cursor Cloud specific instructions

This branch contains **Product B: AI SDLC DREAMTEAM** — a spec-first, multi-agent
SDLC tool. It is an npm-workspaces monorepo:

- `packages/api` — Express backend (TypeScript, ESM). Orchestrates 8 AI agents
  (designer → planner → specificator → coder → reviewer → tester → reporter →
  compliancer). Projects/artifacts/traces are stored on the filesystem under
  `projects/` (there is no database). Calls a local **Ollama** LLM for generation.
- `packages/web` — React 19 + Vite SPA. Dev server proxies `/api` → the API.
- `agents/*.yaml`, `spec/`, `meta/dreamteam.json` — agent definitions, prompt
  templates, and orchestration config, loaded relative to the repo root.

> Note: the repository's `main` branch is intentionally empty ("Clear repository").
> Product B lives on its feature branch(es); do your work from there.

### Running the app (dev)

- Start both servers from the repo root: `npm run dev`
  (uses `concurrently` → API on **http://localhost:3001** via `tsx watch`, web on
  **http://localhost:5173** via Vite). See root `package.json` scripts.
- Health check: `curl http://localhost:3001/api/health` → `{"ollama":true,...}`
  once Ollama is up.
- Core flow: create a project → send a prompt (Designer agent runs and waits for
  user approval) → `approve` runs the rest of the pipeline. The web UI exposes all
  of this (Projects → Chat → Artifacts → Trace).

### Ollama (LLM) — required for agent prompts, and the main gotcha

The API needs Ollama serving `llama3.2` at `http://localhost:11434`
(override with `OLLAMA_URL` / `OLLAMA_MODEL`). The app still boots without it, but
any prompt/agent call fails; `/api/health` reports `"ollama": false`.

- **Ollama is NOT managed by systemd here.** Start it manually each session:
  `nohup ollama serve > /tmp/ollama.log 2>&1 &`  (the `llama3.2` model is already
  pulled into the VM snapshot).
- **Do NOT upgrade Ollama.** The pinned version is **v0.24.0**. The latest release
  (0.31.x) segfaults (`llama-server ... signal: segmentation fault`) during model
  warmup on this VM's virtualized CPU. If Ollama ever gets upgraded and starts
  segfaulting, reinstall v0.24.0:
  `curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION=0.24.0 sh`
- **"model requires more system memory than is available" error:** Ollama's memory
  check trips when the Linux page cache is full (it reads free, not available, RAM).
  Fix by dropping caches: `sudo sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches'`,
  then retry.
- Inference is **CPU-only and slow**: a single Designer prompt takes roughly
  60s–3min. The full `approve` pipeline runs 7 more agents sequentially, so expect
  several minutes. Be patient / use long timeouts when testing.

### Build / test / lint

- Typecheck+build API: `npm run build -w packages/api` (runs `tsc`).
- Typecheck+build web: `npm run build -w packages/web` (`tsc -b && vite build`).
- There is **no automated test suite and no linter configured** in this repo.

### Misc

- Generated projects are written to `projects/` at runtime. Do not commit them
  (only `projects/.gitkeep` is tracked).
- `.gitignore` ignores `node_modules/` and `encore.gen/`.
