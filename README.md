# AI SDLC DREAMTEAM

Spec-first multi-agent demo: local React web app + Node API + **local Ollama**.

## Supported platforms

| OS | Support |
|----|---------|
| **macOS** (Apple Silicon / Intel) | Supported |
| **Linux** (x86_64 / arm64, bash) | Supported |
| **Windows** (native) | **Not supported** |

No Docker. LLM runs locally via Ollama (default model `llama3.2`).

## Requirements

- **Node.js LTS** + npm — https://nodejs.org/
- **Ollama** — https://ollama.com/
- Git

> `main` is intentionally empty. Clone and check out the product branch (e.g. the branch that contains this README / app packages).

## Install (local Ollama)

```bash
git clone <this-repo-url>
cd shiny-robo
git checkout <product-branch>

npm run setup
```

[`scripts/setup.sh`](scripts/setup.sh) first **audits** the machine (OS, CPU arch, Node, npm, Ollama CLI, Ollama server). If anything is missing it prints a **numbered fix list with concrete commands** for your platform (macOS Apple Silicon / Intel, or Linux distro), then asks you to run `npm run setup` again. When the audit passes, it runs `npm install` and `ollama pull` for `$OLLAMA_MODEL` (default `llama3.2`).

The script does **not** silently install system packages with `sudo` / `curl|sh` — you run the printed commands yourself.

Override model: `OLLAMA_MODEL=llama3.2:1b npm run setup`

## Run

```bash
source env/aliases.sh   # sets $API_URL, $WEB_URL, $OLLAMA_URL
# ollama serve          # if not already running
npm run dev
```

- **Web UI:** open `$WEB_URL`
- **API health:** `curl "$API_URL/api/health"` → want `"ollama": true`

Override ports/host before `source`, or export `API_URL` / `OLLAMA_URL` / `OLLAMA_MODEL` afterward. See [`env/aliases.sh`](env/aliases.sh).

## Usage

1. **Projects** — create or select a project  
2. **Agent** — **Send** a prompt → Designer drafts a design (`waiting_user`)  
3. Then either:
   - **Approve design** — runs Planner → … → Compliancer  
   - **Retry design** — new attempt in the same iteration  
   - **Restart design** — new iteration (put an updated prompt in the box first)

Artifacts land under `projects/<name>/…` on disk (no database).

**Note:** On CPU, a single Designer call can take minutes; Approve runs several agents in sequence. Do not re-click Send / Approve / Retry / Restart while a run is in flight.

## Documentation

- [Path specification](spec/PATHS.md)
- [Orchestrator state machine](spec/ORCHESTRATOR.md)
- [Artifact templates](spec/TEMPLATES/)

## Versioning

```
projects/{ProjectName}/v.{R}/
  designs/v.{R}.{B}/v.{R}.{B}.{T}/
```

| Level | Example | Meaning |
|-------|---------|---------|
| Release | `v.1` | Code generation target |
| Design iteration (bundle) | `v.1.1` | One design idea / direction |
| Design attempt (try) | `v.1.1.1` | One draft inside that iteration (**Retry design**: `.2`, `.3`) |

**Retry design** keeps the iteration and adds an attempt. **Restart design** opens a new iteration with an updated prompt. Details: [ORCHESTRATOR.md](spec/ORCHESTRATOR.md).

## Pipeline

Designer → Planner → Specificator → Coder → Reviewer → Tester → Reporter → Compliancer

User approves only Designer high-level description (**Approve design**). All other stages run autonomously.
