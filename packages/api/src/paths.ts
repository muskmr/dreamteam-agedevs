import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const WORKSPACE_ROOT = path.join(REPO_ROOT, "projects");
export const AGENTS_DIR = path.join(REPO_ROOT, "agents");
export const TEMPLATES_DIR = path.join(REPO_ROOT, "spec/TEMPLATES");

export interface VersionRef {
  release: number;
  bundle: number;
  try: number;
}

export function formatRelease(r: number): string {
  return `v.${r}`;
}

export function formatBundle(r: number, b: number): string {
  return `v.${r}.${b}`;
}

export function formatTry(r: number, b: number, t: number): string {
  return `v.${r}.${b}.${t}`;
}

export function parseVersion(version: string): VersionRef | null {
  const match = /^v\.(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(version);
  if (!match) return null;
  return {
    release: Number(match[1]),
    bundle: Number(match[2] ?? 1),
    try: Number(match[3] ?? 1),
  };
}

export function releaseDir(project: string, release: number): string {
  return path.join(WORKSPACE_ROOT, project, formatRelease(release));
}

export function stageTryDir(
  project: string,
  release: number,
  bundle: number,
  tryNum: number,
  stage: string,
): string {
  const bundleStr = formatBundle(release, bundle);
  const tryStr = formatTry(release, bundle, tryNum);
  return path.join(releaseDir(project, release), stage, bundleStr, tryStr);
}

export const STAGES = [
  "designs",
  "contracts",
  "specs",
  "code",
  "tests",
  "reports",
  "prompts",
  "trace",
] as const;

export type Stage = (typeof STAGES)[number];

export const AGENT_ORDER = [
  "designer",
  "planner",
  "specificator",
  "coder",
  "reviewer",
  "tester",
  "reporter",
  "compliancer",
] as const;

export type AgentId = (typeof AGENT_ORDER)[number];

export const AGENT_STAGE_MAP: Record<AgentId, Stage> = {
  designer: "designs",
  planner: "contracts",
  specificator: "specs",
  coder: "code",
  reviewer: "reports",
  tester: "tests",
  reporter: "reports",
  compliancer: "reports",
};
