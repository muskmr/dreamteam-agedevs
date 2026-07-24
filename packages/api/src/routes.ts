import path from "node:path";
import express from "express";
import cors from "cors";
import { checkOllama } from "./ollama.js";
import { REPO_ROOT } from "./paths.js";
import {
  approveAndContinue,
  OrchestratorError,
  restartDesign,
  retryDesign,
  startTry,
} from "./orchestrator.js";
import { readTrace } from "./trace.js";
import { ollamaModel, ollamaUrl } from "./urls.js";
import {
  createProject,
  getProjectMeta,
  listProjects,
  listTryArtifacts,
  makeContext,
  readFile,
} from "./workspace.js";

const OLLAMA = {
  baseUrl: ollamaUrl(),
  model: ollamaModel(),
};

function sendOrchestratorError(res: express.Response, err: unknown): boolean {
  if (err instanceof OrchestratorError) {
    const status = err.code === "conflict" ? 409 : err.code === "not_found" ? 404 : 400;
    res.status(status).json({ error: err.message });
    return true;
  }
  return false;
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", async (_req, res) => {
    const ollamaOk = await checkOllama(OLLAMA);
    res.json({ status: "ok", ollama: ollamaOk, model: OLLAMA.model });
  });

  app.get("/api/projects", async (_req, res) => {
    const projects = await listProjects();
    res.json({ projects });
  });

  app.post("/api/projects", async (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: "Project name required" });
      return;
    }
    const meta = await createProject(name.trim());
    res.json({ meta });
  });

  app.get("/api/projects/:name", async (req, res) => {
    const meta = await getProjectMeta(req.params.name);
    if (!meta) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ meta });
  });

  app.post("/api/projects/:name/prompt", async (req, res) => {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) {
      res.status(400).json({ error: "Prompt required" });
      return;
    }
    const meta = await getProjectMeta(req.params.name);
    if (!meta) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    try {
      const { ctx, result } = await startTry(meta, prompt.trim(), OLLAMA);
      res.json({ ctx, result });
    } catch (err) {
      if (sendOrchestratorError(res, err)) return;
      throw err;
    }
  });

  app.post("/api/projects/:name/approve", async (req, res) => {
    const { summary } = req.body as { summary?: string };
    const meta = await getProjectMeta(req.params.name);
    if (!meta) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const ctx = makeContext(meta.name, meta.currentRelease, meta.currentBundle, meta.currentTry);
    const results = await approveAndContinue(ctx, summary ?? "User approved design", OLLAMA);
    res.json({ ctx, results });
  });

  /** Retry design — same iteration, new attempt; reuses prior prompt (optional note). */
  app.post("/api/projects/:name/retry", async (req, res) => {
    const { note } = req.body as { note?: string };
    const meta = await getProjectMeta(req.params.name);
    if (!meta) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    try {
      const { ctx, result } = await retryDesign(meta, OLLAMA, note);
      res.json({
        ctx,
        result,
        message: `Retry design attempt ${ctx.tryVersion} created`,
      });
    } catch (err) {
      if (sendOrchestratorError(res, err)) return;
      throw err;
    }
  });

  /** Restart design — new iteration; requires updated/supplemented prompt. */
  app.post("/api/projects/:name/new-bundle", async (req, res) => {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) {
      res.status(400).json({
        error: "Restart design requires an updated or supplemented prompt",
      });
      return;
    }
    const meta = await getProjectMeta(req.params.name);
    if (!meta) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    try {
      const { ctx, result } = await restartDesign(meta, prompt.trim(), OLLAMA);
      res.json({
        ctx,
        result,
        message: `Restart design iteration ${ctx.bundleVersion} created`,
      });
    } catch (err) {
      if (sendOrchestratorError(res, err)) return;
      throw err;
    }
  });

  app.get("/api/projects/:name/artifacts", async (req, res) => {
    const meta = await getProjectMeta(req.params.name);
    if (!meta) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const ctx = makeContext(meta.name, meta.currentRelease, meta.currentBundle, meta.currentTry);
    const artifacts = await listTryArtifacts(ctx);
    res.json({ ctx, artifacts });
  });

  app.get("/api/projects/:name/artifact-content", async (req, res) => {
    const relPath = req.query.path as string;
    if (!relPath) {
      res.status(400).json({ error: "path query param required" });
      return;
    }
    const meta = await getProjectMeta(req.params.name);
    if (!meta) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const filePath = path.join(
      REPO_ROOT,
      "projects",
      req.params.name,
      `v.${meta.currentRelease}`,
      relPath,
    );
    const content = await readFile(filePath);
    if (content === null) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    res.type("text/plain").send(content);
  });

  app.get("/api/projects/:name/trace", async (req, res) => {
    const meta = await getProjectMeta(req.params.name);
    if (!meta) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const ctx = makeContext(meta.name, meta.currentRelease, meta.currentBundle, meta.currentTry);
    const events = await readTrace(ctx);
    res.json({ ctx, events });
  });

  return app;
}
