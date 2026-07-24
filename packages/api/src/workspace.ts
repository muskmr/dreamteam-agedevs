import fs from "node:fs/promises";
import path from "node:path";
import {
  AGENT_ORDER,
  formatBundle,
  formatRelease,
  formatTry,
  releaseDir,
  stageTryDir,
  STAGES,
  TEMPLATES_DIR,
  WORKSPACE_ROOT,
  type AgentId,
  type VersionRef,
} from "./paths.js";

export interface ProjectMeta {
  name: string;
  createdAt: string;
  currentRelease: number;
  currentBundle: number;
  currentTry: number;
}

export interface TryContext {
  project: string;
  release: number;
  bundle: number;
  try: number;
  bundleVersion: string;
  tryVersion: string;
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");
}

export async function readFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  const raw = await readFile(filePath);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
}

async function loadTemplate(name: string, vars: Record<string, string>): Promise<string> {
  const templatePath = path.join(TEMPLATES_DIR, name);
  let content = await fs.readFile(templatePath, "utf-8");
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{${key}}`, value);
  }
  return content;
}

export async function listProjects(): Promise<string[]> {
  await ensureDir(WORKSPACE_ROOT);
  const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function createProject(name: string): Promise<ProjectMeta> {
  const meta: ProjectMeta = {
    name,
    createdAt: new Date().toISOString(),
    currentRelease: 1,
    currentBundle: 1,
    currentTry: 1,
  };
  const metaDir = path.join(releaseDir(name, 1), "meta");
  await ensureDir(metaDir);
  await writeJson(path.join(metaDir, "project.json"), meta);
  return meta;
}

export async function getProjectMeta(project: string): Promise<ProjectMeta | null> {
  const releases = await listReleases(project);
  if (releases.length === 0) return null;
  return readJson<ProjectMeta>(
    path.join(releaseDir(project, releases[releases.length - 1]), "meta", "project.json"),
  );
}

export async function saveProjectMeta(project: string, meta: ProjectMeta): Promise<void> {
  await writeJson(
    path.join(releaseDir(project, meta.currentRelease), "meta", "project.json"),
    meta,
  );
}

export async function listReleases(project: string): Promise<number[]> {
  const projectDir = path.join(WORKSPACE_ROOT, project);
  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && /^v\.\d+$/.test(e.name))
      .map((e) => Number(e.name.slice(2)))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function makeContext(
  project: string,
  release: number,
  bundle: number,
  tryNum: number,
): TryContext {
  return {
    project,
    release,
    bundle,
    try: tryNum,
    bundleVersion: formatBundle(release, bundle),
    tryVersion: formatTry(release, bundle, tryNum),
  };
}

export async function scaffoldTry(ctx: TryContext, prompt: string): Promise<void> {
  const vars = {
    project: ctx.project,
    bundle: ctx.bundleVersion,
    try: ctx.tryVersion,
    actor: "",
  };

  for (const stage of STAGES) {
    await ensureDir(stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, stage));
  }

  const promptDir = stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "prompts");
  await writeFile(path.join(promptDir, "prompt.md"), prompt);
  await writeJson(path.join(promptDir, "context.json"), {
    project: ctx.project,
    release: formatRelease(ctx.release),
    bundle: ctx.bundleVersion,
    try: ctx.tryVersion,
    createdAt: new Date().toISOString(),
    status: "active",
    currentAgent: "designer",
  });

  const designDir = stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "designs");
  await writeFile(
    path.join(designDir, "design.md"),
    await loadTemplate("design.md", vars),
  );
  await writeJson(path.join(designDir, "approval.json"), {
    artifact: "design.md",
    bundle: ctx.bundleVersion,
    try: ctx.tryVersion,
    status: "pending",
    approvedBy: null,
    approvedAt: null,
    summary: null,
  });

  const traceDir = stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "trace");
  await writeFile(path.join(traceDir, "events.jsonl"), "");
}

export async function writeAgentArtifact(
  ctx: TryContext,
  agent: AgentId,
  content: string,
  filename: string,
): Promise<string> {
  const stage = agent === "designer"
    ? "designs"
    : agent === "planner"
      ? "contracts"
      : agent === "specificator"
        ? "specs"
        : agent === "coder"
          ? "code"
          : agent === "tester"
            ? "tests"
            : "reports";

  const dir =
    stage === "reports"
      ? path.join(
          stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "reports"),
          agent,
        )
      : stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, stage);

  const filePath = path.join(dir, filename);
  await writeFile(filePath, content);
  return filePath;
}

export async function writeAgentReport(
  ctx: TryContext,
  agent: AgentId,
  summary: string,
): Promise<string> {
  const vars = { actor: agent, bundle: ctx.bundleVersion, try: ctx.tryVersion };
  const templateName =
    agent === "reporter"
      ? "reporter-report.md"
      : agent === "compliancer"
        ? "compliancer-report.md"
        : "report.md";
  let content = await loadTemplate(templateName, vars);
  content = content.replace("## Summary\n-", `## Summary\n${summary}`);
  const reportDir = path.join(
    stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "reports"),
    agent,
  );
  const filePath = path.join(reportDir, "report.md");
  await writeFile(filePath, content);
  return filePath;
}

export async function isDesignApproved(ctx: TryContext): Promise<boolean> {
  const approval = await readJson<{ status: string }>(
    path.join(
      stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "designs"),
      "approval.json",
    ),
  );
  return approval?.status === "approved";
}

export async function isSpecApproved(ctx: TryContext): Promise<boolean> {
  const approval = await readJson<{ status: string }>(
    path.join(
      stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "specs"),
      "approval.json",
    ),
  );
  return approval?.status === "approved";
}

export async function approveDesign(
  ctx: TryContext,
  summary: string,
): Promise<void> {
  await writeJson(
    path.join(
      stageTryDir(ctx.project, ctx.release, ctx.bundle, ctx.try, "designs"),
      "approval.json",
    ),
    {
      artifact: "design.md",
      bundle: ctx.bundleVersion,
      try: ctx.tryVersion,
      status: "approved",
      approvedBy: "user",
      approvedAt: new Date().toISOString(),
      summary,
    },
  );
}

export async function listTryArtifacts(ctx: TryContext): Promise<string[]> {
  const base = releaseDir(ctx.project, ctx.release);
  const bundleStr = ctx.bundleVersion;
  const tryStr = ctx.tryVersion;
  const results: string[] = [];

  async function walk(dir: string, prefix: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, rel);
        } else {
          results.push(rel);
        }
      }
    } catch {
      // directory may not exist yet
    }
  }

  for (const stage of STAGES) {
    const stagePath = path.join(base, stage, bundleStr, tryStr);
    await walk(stagePath, `${stage}/${bundleStr}/${tryStr}`);
  }

  return results.sort();
}

export function nextAgent(current: AgentId | null): AgentId | null {
  if (!current) return AGENT_ORDER[0];
  const idx = AGENT_ORDER.indexOf(current);
  if (idx === -1 || idx === AGENT_ORDER.length - 1) return null;
  return AGENT_ORDER[idx + 1];
}

export function bumpTry(ref: VersionRef): VersionRef {
  return { ...ref, try: ref.try + 1 };
}

export function bumpBundle(ref: VersionRef): VersionRef {
  return { release: ref.release, bundle: ref.bundle + 1, try: 1 };
}
