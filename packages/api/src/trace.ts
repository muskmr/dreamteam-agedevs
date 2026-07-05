import fs from "node:fs/promises";
import path from "node:path";
import { stageTryDir, type AgentId } from "./paths.js";
import type { TryContext } from "./workspace.js";

export type TraceEventType =
  | "prompt_received"
  | "agent_started"
  | "agent_completed"
  | "artifact_written"
  | "gate_blocked"
  | "gate_passed"
  | "user_approved"
  | "try_started"
  | "bundle_started"
  | "compliance_pass"
  | "compliance_fail";

export interface TraceEvent {
  ts: string;
  release: string;
  bundle: string;
  try: string;
  actor: AgentId | "user" | "system";
  event: TraceEventType;
  path?: string;
  promptRef?: string;
  meta?: Record<string, unknown>;
}

function traceFile(ctx: TryContext): string {
  return path.join(
    stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "trace"),
    "events.jsonl",
  );
}

export async function appendTrace(ctx: TryContext, event: Omit<TraceEvent, "ts" | "release" | "bundle" | "try">): Promise<void> {
  const record: TraceEvent = {
    ts: new Date().toISOString(),
    release: `v.${ctx.release}`,
    bundle: ctx.bundleVersion,
    try: ctx.tryVersion,
    ...event,
  };
  const file = traceFile(ctx);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(record) + "\n", "utf-8");
}

export async function readTrace(ctx: TryContext): Promise<TraceEvent[]> {
  const file = traceFile(ctx);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TraceEvent);
  } catch {
    return [];
  }
}
