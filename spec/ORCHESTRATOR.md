# Orchestrator State Machine

## AI SDLC DREAMTEAM pipeline

Designer → Planner → Specificator → Coder → Reviewer → Tester → Reporter → Compliancer

## Rules

| Event | Action |
|-------|--------|
| New prompt | Create bundle + try `.1` |
| User rejects design direction | New bundle `B+1`, try `.1` |
| User approves design | Write `approval.json`; unlock Planner |
| Spec not approved | Coder blocked |
| Agent failure / retest | Same bundle, try `T+1` |
| Compliancer pass | Try done |

## Trace events

`prompt_received`, `agent_started`, `agent_completed`, `artifact_written`, `gate_blocked`, `gate_passed`, `user_approved`, `try_started`, `bundle_started`, `compliance_pass`, `compliance_fail`
