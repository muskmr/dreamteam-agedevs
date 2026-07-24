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

For a normal local machine (macOS / Linux), prefer the turnkey path in
[README.md](README.md): `npm run setup`, then `source env/aliases.sh` and
`npm run dev`. Windows is not supported.

In this Cloud VM specifically:

- Load URL aliases once per shell: `source env/aliases.sh`
  (exports `$API_URL`, `$WEB_URL`, `$OLLAMA_URL`, plus `API_PORT` / `WEB_PORT` / `OLLAMA_PORT`).
- Start both servers from the repo root: `npm run dev`
  (uses `concurrently` → API via `tsx watch`, web via Vite; ports come from the aliases).
- Health check: `curl "$API_URL/api/health"` → `{"ollama":true,...}` once Ollama is up.
- Core flow: create a project → send a prompt (Designer agent runs and waits for
  user approval) → `approve` runs the rest of the pipeline. The web UI exposes all
  of this (Projects → Chat → Artifacts → Trace).

### Ollama (LLM) — required for agent prompts, and the main gotcha

The API needs Ollama serving `llama3.2` at `$OLLAMA_URL`
(override with `OLLAMA_URL` / `OLLAMA_MODEL`, or `OLLAMA_PORT` before sourcing aliases).
The app still boots without it, but any prompt/agent call fails; `/api/health`
reports `"ollama": false`.

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
- Inference is **CPU-only and slow** (measured on this VM, 4 cores): a single
  Designer prompt takes ~40–90s, and clicking **Approve design** runs 7 more agents
  sequentially and takes **~8–9 minutes total** (each agent ~40–120s).
  - The web UI has **no progress indicator** — during these calls the buttons just
    disable, so it looks frozen/"not working" but it is not. **Wait for it to
    finish** (the `/api/.../approve` request is a single long HTTP call).
  - **Do NOT re-click** Send/Approve or hit **Restart design / Retry design** while a run is in
    flight. Those mutate the project's `currentBundle`/`currentTry` in `meta.json`,
    which desyncs the in-flight run and leaves half-written `contracts/` `specs/`
    `code/` dirs (this is what "not working" usually turns out to be).
  - To watch progress instead of guessing, tail the trace:
    `find projects/<name>/v.1/trace -name events.jsonl -exec tail -f {} +`.
  - Optional speed-up for iteration: pull `ollama pull llama3.2:1b` and start the API
    with `OLLAMA_MODEL=llama3.2:1b npm run dev` (somewhat faster, lower-quality output).

### Build / test / lint

- Typecheck+build API: `npm run build -w packages/api` (runs `tsc`).
- Typecheck+build web: `npm run build -w packages/web` (`tsc -b && vite build`).
- There is **no automated test suite and no linter configured** in this repo.

### Misc

- Generated projects are written to `projects/` at runtime. Do not commit them
  (only `projects/.gitkeep` is tracked).
- `.gitignore` ignores `node_modules/` and `encore.gen/`.
