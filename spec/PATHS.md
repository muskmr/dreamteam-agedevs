# Path Specification

## Hierarchy

| Level | Pattern | Example | Meaning |
|-------|---------|---------|---------|
| Workspace | `{workspace}/` | `~/ai-course-workspace/` | User-selected root |
| Project | `projects/{ProjectName}/` | `projects/ProjectX/` | Course product |
| Release | `v.{R}/` | `v.1/` | Code generation target |
| Design iteration (bundle) | `v.{R}.{B}/` | `v.1.1/` | One design idea / direction |
| Design attempt (try) | `v.{R}.{B}.{T}/` | `v.1.1.1/` | One draft inside that iteration |

## Transitions

- `v.1` → `v.2` — new release
- `v.1.1` → `v.1.2` — **Restart design** (new iteration / new idea + updated prompt)
- `v.1.1.1` → `v.1.1.2` — **Retry design** (same iteration, new attempt)

See [ORCHESTRATOR.md](ORCHESTRATOR.md) for the design loop and approval rules.

## Full tree

```
projects/{ProjectName}/v.{R}/
  meta/project.json
  meta/dreamteam.json
  designs/v.{R}.{B}/v.{R}.{B}.{T}/design.md
  designs/v.{R}.{B}/v.{R}.{B}.{T}/approval.json   # only on the approved attempt
  contracts/v.{R}.{B}/v.{R}.{B}.{T}/compliance-contract.md
  specs/v.{R}.{B}/v.{R}.{B}.{T}/spec.md
  specs/v.{R}.{B}/v.{R}.{B}.{T}/approval.json
  code/v.{R}.{B}/v.{R}.{B}.{T}/
  tests/v.{R}.{B}/v.{R}.{B}.{T}/
  reports/v.{R}.{B}/v.{R}.{B}.{T}/{actor}/report.md
  prompts/v.{R}.{B}/v.{R}.{B}.{T}/prompt.md
  prompts/v.{R}.{B}/v.{R}.{B}.{T}/context.json
  trace/v.{R}.{B}/v.{R}.{B}.{T}/events.jsonl
```

## Gates

- **User gate:** `designs/.../approval.json` — only human approval; present only on the approved attempt
- **Agent gate:** `specs/.../approval.json` — blocks Coder until approved
