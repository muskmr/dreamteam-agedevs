import fs from "node:fs/promises";
import path from "node:path";
import { buildSystemPrompt, loadAgent } from "./agents.js";
import { chat, type OllamaConfig } from "./ollama.js";
import { AGENT_ORDER, stageTryDir, type AgentId } from "./paths.js";
import { appendTrace } from "./trace.js";
import {
  approveDesign,
  isDesignApproved,
  isSpecApproved,
  makeContext,
  readFile,
  saveProjectMeta,
  scaffoldTry,
  writeAgentArtifact,
  writeAgentReport,
  writeFile,
  writeJson,
  type ProjectMeta,
  type TryContext,
} from "./workspace.js";

export interface RunAgentResult {
  agent: AgentId;
  status: "completed" | "blocked" | "waiting_user";
  outputPath?: string;
  message: string;
}

async function gateCheck(ctx: TryContext, agent: AgentId): Promise<string | null> {
  const config = await loadAgent(agent);
  for (const req of config.requires) {
    if (req === "design_approved" && !(await isDesignApproved(ctx))) {
      return "Design not approved by user";
    }
    if (req === "contract") {
      const contract = await readFile(
        path.join(
          stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "contracts"),
          "compliance-contract.md",
        ),
      );
      if (!contract) return "Compliance contract not found";
    }
    if (req === "spec_approved" && !(await isSpecApproved(ctx))) {
      return "Spec not approved";
    }
    if (req === "code") {
      const codeDir = stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "code");
      try {
        const files = await fs.readdir(codeDir);
        if (files.length === 0) return "No code artifacts";
      } catch {
        return "No code artifacts";
      }
    }
    if (req === "tester") {
      const report = await readFile(
        path.join(
          stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "reports"),
          "tester/report.md",
        ),
      );
      if (!report) return "Tester report not found";
    }
    if (req === "reporter") {
      const report = await readFile(
        path.join(
          stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "reports"),
          "reporter/report.md",
        ),
      );
      if (!report) return "Reporter summary not found";
    }
  }
  return null;
}

async function gatherInputs(ctx: TryContext, agent: AgentId): Promise<string> {
  const parts: string[] = [];
  const design = await readFile(
    path.join(stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "designs"), "design.md"),
  );
  if (design) parts.push(`## Design\n${design}`);

  const contract = await readFile(
    path.join(
      stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "contracts"),
      "compliance-contract.md",
    ),
  );
  if (contract) parts.push(`## Contract\n${contract}`);

  const spec = await readFile(
    path.join(stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "specs"), "spec.md"),
  );
  if (spec) parts.push(`## Spec\n${spec}`);

  const prompt = await readFile(
    path.join(stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "prompts"), "prompt.md"),
  );
  if (prompt) parts.push(`## User prompt\n${prompt}`);

  return parts.join("\n\n") || "No prior artifacts.";
}

export async function runAgent(
  ctx: TryContext,
  agent: AgentId,
  ollama: OllamaConfig,
  userMessage?: string,
): Promise<RunAgentResult> {
  const config = await loadAgent(agent);

  if (agent === "designer" && config.humanInLoop) {
    const approved = await isDesignApproved(ctx);
    if (!approved && !userMessage?.toLowerCase().includes("approve")) {
      await appendTrace(ctx, { actor: "designer", event: "agent_started" });
      const response = await chat(ollama, [
        {
          role: "system",
          content: buildSystemPrompt(config, {
            project: ctx.project,
            bundle: ctx.bundleVersion,
            try: ctx.tryVersion,
          }),
        },
        {
          role: "user",
          content: userMessage ?? "Prepare a high-level design based on the user prompt.",
        },
      ]);
      const designPath = await writeAgentArtifact(ctx, "designer", response, "design.md");
      await writeAgentReport(ctx, "designer", "Design draft prepared for user review.");
      await appendTrace(ctx, {
        actor: "designer",
        event: "artifact_written",
        path: designPath,
      });
      await appendTrace(ctx, { actor: "designer", event: "agent_completed" });
      return {
        agent,
        status: "waiting_user",
        outputPath: designPath,
        message: "Design prepared. Review and send a message containing 'approve' to continue.",
      };
    }
  }

  const blocked = await gateCheck(ctx, agent);
  if (blocked) {
    await appendTrace(ctx, { actor: agent, event: "gate_blocked", meta: { reason: blocked } });
    return { agent, status: "blocked", message: blocked };
  }

  await appendTrace(ctx, { actor: agent, event: "agent_started" });

  const inputs = await gatherInputs(ctx, agent);
  const response = await chat(ollama, [
    {
      role: "system",
      content: buildSystemPrompt(config, {
        project: ctx.project,
        bundle: ctx.bundleVersion,
        try: ctx.tryVersion,
      }),
    },
    { role: "user", content: `${inputs}\n\nTask: Perform your role and produce the required artifact content.` },
  ]);

  let outputPath: string;
  switch (agent) {
    case "planner":
      outputPath = await writeAgentArtifact(ctx, "planner", response, "compliance-contract.md");
      break;
    case "specificator":
      outputPath = await writeAgentArtifact(ctx, "specificator", response, "spec.md");
      await writeJson(
        path.join(stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "specs"), "approval.json"),
        {
          artifact: "spec.md",
          status: "approved",
          approvedBy: "specificator",
          approvedAt: new Date().toISOString(),
        },
      );
      await appendTrace(ctx, { actor: "specificator", event: "gate_passed", meta: { gate: "spec_approved" } });
      break;
    case "coder":
      outputPath = await writeAgentArtifact(ctx, "coder", response, "main.md");
      break;
    case "tester":
      outputPath = await writeAgentArtifact(ctx, "tester", response, "tests.md");
      break;
    default:
      outputPath = await writeAgentReport(ctx, agent, response.slice(0, 500));
  }

  if (agent !== "designer") {
    await writeAgentReport(ctx, agent, response.slice(0, 500));
  }

  await appendTrace(ctx, { actor: agent, event: "artifact_written", path: outputPath });
  await appendTrace(ctx, { actor: agent, event: "agent_completed" });

  return { agent, status: "completed", outputPath, message: `${config.role} completed.` };
}

export async function startTry(
  meta: ProjectMeta,
  prompt: string,
  ollama: OllamaConfig,
): Promise<{ ctx: TryContext; result: RunAgentResult }> {
  const ctx = makeContext(meta.name, meta.currentRelease, meta.currentBundle, meta.currentTry);
  await scaffoldTry(ctx, prompt);
  await appendTrace(ctx, { actor: "system", event: "try_started" });
  await appendTrace(ctx, {
    actor: "user",
    event: "prompt_received",
    promptRef: `prompts/${ctx.bundleVersion}/${ctx.tryVersion}/prompt.md`,
  });
  const result = await runAgent(ctx, "designer", ollama, prompt);
  return { ctx, result };
}

export async function approveAndContinue(
  ctx: TryContext,
  summary: string,
  ollama: OllamaConfig,
): Promise<RunAgentResult[]> {
  await approveDesign(ctx, summary);
  await appendTrace(ctx, { actor: "user", event: "user_approved", meta: { summary } });

  const results: RunAgentResult[] = [];
  const startIdx = AGENT_ORDER.indexOf("planner");

  for (let i = startIdx; i < AGENT_ORDER.length; i++) {
    const agent = AGENT_ORDER[i];
    const result = await runAgent(ctx, agent, ollama);
    results.push(result);
    if (result.status === "blocked") break;
  }

  return results;
}

export async function retryTry(meta: ProjectMeta): Promise<TryContext> {
  meta.currentTry += 1;
  await saveProjectMeta(meta.name, meta);
  return makeContext(meta.name, meta.currentRelease, meta.currentBundle, meta.currentTry);
}

export async function newBundle(meta: ProjectMeta): Promise<TryContext> {
  meta.currentBundle += 1;
  meta.currentTry = 1;
  await saveProjectMeta(meta.name, meta);
  return makeContext(meta.name, meta.currentRelease, meta.currentBundle, meta.currentTry);
}
