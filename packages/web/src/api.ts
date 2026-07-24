const API = "/api";

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

export interface TraceEvent {
  ts: string;
  release: string;
  bundle: string;
  try: string;
  actor: string;
  event: string;
  path?: string;
  meta?: Record<string, unknown>;
}

export async function getHealth(): Promise<{ ollama: boolean; model: string }> {
  const res = await fetch(`${API}/health`);
  return res.json();
}

export async function listProjects(): Promise<string[]> {
  const res = await fetch(`${API}/projects`);
  const data = await res.json();
  return data.projects;
}

export async function createProject(name: string): Promise<ProjectMeta> {
  const res = await fetch(`${API}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  return data.meta;
}

export async function getProject(name: string): Promise<ProjectMeta> {
  const res = await fetch(`${API}/projects/${encodeURIComponent(name)}`);
  const data = await res.json();
  return data.meta;
}

export async function sendPrompt(name: string, prompt: string) {
  const res = await fetch(`${API}/projects/${encodeURIComponent(name)}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  return res.json();
}

export async function approveDesign(name: string, summary: string) {
  const res = await fetch(`${API}/projects/${encodeURIComponent(name)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summary }),
  });
  return res.json();
}

export async function retryTry(name: string) {
  const res = await fetch(`${API}/projects/${encodeURIComponent(name)}/retry`, {
    method: "POST",
  });
  return res.json();
}

export async function newBundle(name: string) {
  const res = await fetch(`${API}/projects/${encodeURIComponent(name)}/new-bundle`, {
    method: "POST",
  });
  return res.json();
}

export async function listArtifacts(name: string): Promise<{ ctx: TryContext; artifacts: string[] }> {
  const res = await fetch(`${API}/projects/${encodeURIComponent(name)}/artifacts`);
  return res.json();
}

export async function getArtifact(name: string, artifactPath: string): Promise<string> {
  const res = await fetch(
    `${API}/projects/${encodeURIComponent(name)}/artifact-content?path=${encodeURIComponent(artifactPath)}`,
  );
  return res.text();
}

export async function getTrace(name: string): Promise<{ ctx: TryContext; events: TraceEvent[] }> {
  const res = await fetch(`${API}/projects/${encodeURIComponent(name)}/trace`);
  return res.json();
}
