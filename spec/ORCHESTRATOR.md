# Orchestrator State Machine

Runtime model for AI SDLC DREAMTEAM (API + Chat UI). Path layout details live in [PATHS.md](PATHS.md).

## Pipeline

```
Designer → Planner → Specificator → Coder → Reviewer → Tester → Reporter → Compliancer
```

Only **Designer** is human-in-the-loop. After the user approves a design attempt, the rest of the pipeline runs autonomously.

## Terminology

| User-facing term | Version level | Path segment | Meaning |
|------------------|---------------|--------------|---------|
| Design iteration | Bundle `B` | `v.{R}.{B}` | One design *idea* / direction spawned by a user prompt |
| Design attempt | Try `T` | `v.{R}.{B}.{T}` | One concrete draft inside that iteration |
| **Retry design** | Same bundle, `T+1` | new try folder | Another attempt at the *same* idea |
| **Restart design** | Bundle `B+1`, try `.1` | new iteration folder | New idea; user supplements or rewrites the prompt |
| **Approve design** | — | writes `approval` in that try | Unlocks Planner and the rest of the pipeline |

## Design loop

A user prompt opens the first **design iteration** folder. Inside it, each Designer run creates a **design attempt** folder with a Markdown draft. **Retry design** keeps the iteration folder and adds a new attempt (reuses the prior prompt). When the direction is wrong, **Restart design** (requires an updated/supplemented prompt in Chat) creates a new iteration folder and starts attempts from `.1` again. Sending a prompt again on an attempt that already has a draft is rejected — use Retry or Restart instead.

```
User prompt
    │
    ▼
┌─────────────────────────────────────────────┐
│  Design iteration #1  (bundle v.{R}.1)      │
│                                             │
│   attempt .1/  design.md                    │
│   attempt .2/  design.md   ← Retry design   │
│   attempt .3/  design.md   ← Retry design   │
└─────────────────────────────────────────────┘
    │
    │  direction is wrong → Restart design
    │  + supplemented / new prompt
    ▼
┌─────────────────────────────────────────────┐
│  Design iteration #2  (bundle v.{R}.2)      │
│   attempt .1/  design.md                    │
│   …                                         │
└─────────────────────────────────────────────┘
```

### Human-in-the-loop

```
                 Send prompt
                      │
                      ▼
              runAgent(designer)
                      │
                      ▼
              write design.md
                      │
                      ▼
           ┌─ waiting_user (Chat) ─┐
           │                       │
           │                       │
    Approve design          Retry design
           │                (same iteration)
           │                       │
           ▼                       ▼
    write approval            new attempt folder
    unlock Planner…           then new design.md
           │                       │
           │                       └──► waiting_user again
           │
           │              Restart design
           │              (new iteration + new/updated prompt)
           │                       │
           │                       ▼
           │                 new iteration folder
           │                 attempt .1 + design.md
           │                       │
           │                       └──► waiting_user again
           ▼
     Planner → … → Compliancer
```

### Files per design attempt

Each attempt folder under `designs/` holds either one or two files:

| State | Files |
|-------|--------|
| Draft (pending or rejected) | `design.md` only |
| Approved | `design.md` + `approval` |

Rules:

- Every proposed draft is kept as Markdown in its own attempt folder. Drafts are never overwritten by a later attempt.
- Rejected / superseded attempts keep `design.md` and do **not** carry `approval`.
- Only the approved attempt (the one that unlocked the pipeline) has `approval` in its folder.

Example after two retries and then approve on the third attempt:

```
designs/v.1.1/v.1.1.1/design.md
designs/v.1.1/v.1.1.2/design.md
designs/v.1.1/v.1.1.3/design.md
designs/v.1.1/v.1.1.3/approval.json
```

## Full pipeline after approval

```
Approve design
      │
      ▼
  Planner        → contracts/.../compliance-contract.md
      │
  Specificator   → specs/.../spec.md (+ spec approval gate)
      │
  Coder          → code/...
      │
  Reviewer       → reports/reviewer/
      │
  Tester         → tests/...
      │
  Reporter       → reports/reporter/
      │
  Compliancer    → reports/compliancer/
```

## Rules

| Event | Action |
|-------|--------|
| First / Restart prompt | Create design iteration (bundle `B` or `B+1`) and attempt `.1`; run Designer; wait for user |
| Retry design | Same iteration; create attempt `T+1`; run Designer; wait for user |
| Restart design | New iteration `B+1`, attempt `.1`; require updated/supplemented prompt; run Designer; wait for user |
| Approve design | Write `approval` in the current attempt folder; unlock Planner through Compliancer |
| Spec not approved | Coder blocked |
| Agent failure / retest (post-design) | Same bundle, try `T+1` |
| Compliancer pass | Try done |

## Trace events

`prompt_received`, `agent_started`, `agent_completed`, `artifact_written`, `gate_blocked`, `gate_passed`, `user_approved`, `try_started`, `bundle_started`, `compliance_pass`, `compliance_fail`
