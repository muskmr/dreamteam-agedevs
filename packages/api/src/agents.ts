import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { AGENTS_DIR, type AgentId } from "./paths.js";

export interface AgentConfig {
  id: AgentId;
  role: string;
  humanInLoop: boolean;
  writes: string[];
  requires: string[];
  description: string;
}

export async function loadAgent(id: AgentId): Promise<AgentConfig> {
  const file = path.join(AGENTS_DIR, `${id}.yaml`);
  const raw = await fs.readFile(file, "utf-8");
  return YAML.parse(raw) as AgentConfig;
}

export async function loadAllAgents(): Promise<AgentConfig[]> {
  const files = await fs.readdir(AGENTS_DIR);
  const agents: AgentConfig[] = [];
  for (const file of files.filter((f) => f.endsWith(".yaml"))) {
    const raw = await fs.readFile(path.join(AGENTS_DIR, file), "utf-8");
    agents.push(YAML.parse(raw) as AgentConfig);
  }
  return agents;
}

export function buildSystemPrompt(
  agent: AgentConfig,
  ctx: { project: string; bundle: string; try: string },
): string {
  return `You are the ${agent.role} agent in the AI SDLC DREAMTEAM.
Project: ${ctx.project}
Bundle: ${ctx.bundle}
Try: ${ctx.try}

Role: ${agent.description}

You may only act within your role. Produce clear, structured markdown output.
Do not write code unless you are the Coder agent.
Do not approve specs unless you are the Specificator agent.`;
}
