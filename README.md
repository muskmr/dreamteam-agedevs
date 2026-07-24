# AI SDLC DREAMTEAM

Spec-first, multi-agent training course for developers. Local React web app + Node API + Ollama.

## Quick start

```bash
npm install
ollama pull llama3.2
source env/aliases.sh   # sets $API_URL, $WEB_URL, $OLLAMA_URL
npm run dev
```

- **Web UI:** `$WEB_URL`
- **API:** `$API_URL`
- **Ollama:** `$OLLAMA_URL` (override with env before `source`, or export after)

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

## AI SDLC DREAMTEAM

Designer → Planner → Specificator → Coder → Reviewer → Tester → Reporter → Compliancer

User approves only Designer high-level description (**Approve design**). All other stages run autonomously.
