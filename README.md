# AI SDLC DREAMTEAM

Spec-first, multi-agent training course for developers. Local React web app + Node API + Ollama.

## Quick start

```bash
npm install
ollama pull llama3.2
npm run dev
```

- **Web UI:** http://localhost:5173
- **API:** http://localhost:3001

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
| Bundle | `v.1.1` | Aligned artifact set |
| Try | `v.1.1.1` | One prompt realisation (retries: `.2`, `.3`) |

## AI SDLC DREAMTEAM

Designer → Planner → Specificator → Coder → Reviewer → Tester → Reporter → Compliancer

User approves only Designer high-level description. All other stages run autonomously.
