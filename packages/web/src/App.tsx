import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveDesign,
  createProject,
  getArtifact,
  getHealth,
  getProject,
  getTrace,
  listArtifacts,
  listProjects,
  restartDesign,
  retryDesign,
  sendPrompt,
  type ProjectMeta,
  type TraceEvent,
} from "./api";

type View = "chat" | "artifacts" | "trace" | "projects";

interface ChatMessage {
  role: "user" | "system";
  text: string;
}

const PIPELINE = [
  "designer",
  "planner",
  "specificator",
  "coder",
  "reviewer",
  "tester",
  "reporter",
  "compliancer",
] as const;

const NAV: { id: View; label: string; icon: string; needsProject?: boolean }[] = [
  { id: "projects", label: "Projects", icon: "P" },
  { id: "chat", label: "Agent", icon: "A", needsProject: true },
  { id: "artifacts", label: "Artifacts", icon: "F", needsProject: true },
  { id: "trace", label: "Trace", icon: "T", needsProject: true },
];

function pipelineProgress(trace: TraceEvent[], loading: boolean): {
  done: Set<string>;
  current: string | null;
  gate: string;
} {
  const done = new Set<string>();
  for (const e of trace) {
    if (e.event === "agent_completed" || e.event === "user_approved") {
      done.add(e.actor === "user" ? "designer" : e.actor);
    }
  }
  if (done.has("user")) done.add("designer");

  let current: string | null = null;
  for (const agent of PIPELINE) {
    if (!done.has(agent)) {
      current = agent;
      break;
    }
  }

  let gate = "idle";
  if (loading) gate = "agent_running";
  else if (done.has("designer") && !done.has("planner") && current === "planner") {
    // designer completed but planner not started → usually waiting_user before approve,
    // or post-approve in flight; prefer waiting_user if last designer status was waiting
    const lastDesigner = [...trace].reverse().find((e) => e.actor === "designer");
    if (lastDesigner?.event === "agent_completed") gate = "waiting_user";
  } else if (current && done.has("designer")) {
    gate = current;
  } else if (!done.has("designer") && trace.some((e) => e.actor === "designer")) {
    gate = "waiting_user";
  }

  // Refine: if designer completed and no planner yet and not loading → waiting_user
  if (!loading && done.has("designer") && !trace.some((e) => e.actor === "planner" && e.event === "agent_started")) {
    const approved = trace.some((e) => e.event === "user_approved");
    gate = approved ? (current ?? "running") : "waiting_user";
  }

  return { done, current, gate };
}

export default function App() {
  const [view, setView] = useState<View>("projects");
  const [projects, setProjects] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [meta, setMeta] = useState<ProjectMeta | null>(null);
  const [ollamaOk, setOllamaOk] = useState(false);
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [newName, setNewName] = useState("ProjectX");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [artifactContent, setArtifactContent] = useState("");
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hostOs, setHostOs] = useState("unknown");
  const [ollamaHintOpen, setOllamaHintOpen] = useState(false);

  const refresh = useCallback(async () => {
    const health = await getHealth();
    setOllamaOk(health.ollama);
    if (health.model) setOllamaModel(health.model);
    if (health.hostOs) setHostOs(health.hostOs);
    const list = await listProjects();
    setProjects(list);
    if (activeProject) {
      const m = await getProject(activeProject);
      setMeta(m);
      const arts = await listArtifacts(activeProject);
      setArtifacts(arts.artifacts);
      const tr = await getTrace(activeProject);
      setTrace(tr.events);
    }
  }, [activeProject]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const progress = useMemo(
    () => pipelineProgress(trace, loading),
    [trace, loading],
  );

  async function handleCreateProject() {
    if (!newName.trim()) return;
    const m = await createProject(newName.trim());
    setActiveProject(m.name);
    setMeta(m);
    setMessages([]);
    await refresh();
    setView("chat");
  }

  async function handleSendPrompt() {
    if (!activeProject || !prompt.trim()) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    try {
      const data = await sendPrompt(activeProject, prompt);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: data.result.message },
      ]);
      setPrompt("");
      await refresh();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: err instanceof Error ? err.message : "Send prompt failed" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!activeProject) return;
    setLoading(true);
    try {
      const data = await approveDesign(activeProject, "User approved high-level design");
      const msgs = data.results.map(
        (r: { agent: string; message: string; status: string }) =>
          `[${r.agent}] ${r.status}: ${r.message}`,
      );
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "Design approved. DREAMTEAM pipeline running..." },
        ...msgs.map((text: string) => ({ role: "system" as const, text })),
      ]);
      await refresh();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: err instanceof Error ? err.message : "Approve failed" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetryDesign() {
    if (!activeProject) return;
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "system", text: "Retry design: new attempt in the same iteration..." },
    ]);
    try {
      const data = await retryDesign(activeProject);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: data.result?.message ?? data.message },
      ]);
      await refresh();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: err instanceof Error ? err.message : "Retry design failed" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestartDesign() {
    if (!activeProject || !prompt.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: "Restart design needs an updated or supplemented prompt in the box above.",
        },
      ]);
      return;
    }
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: `[Restart design] ${prompt}` },
    ]);
    try {
      const data = await restartDesign(activeProject, prompt);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: data.result?.message ?? data.message },
      ]);
      setPrompt("");
      await refresh();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: err instanceof Error ? err.message : "Restart design failed" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectArtifact(path: string) {
    if (!activeProject) return;
    setSelectedArtifact(path);
    const content = await getArtifact(activeProject, path);
    setArtifactContent(content);
  }

  const releaseLabel = meta ? `v.${meta.currentRelease}` : null;
  const bundleLabel = meta
    ? `v.${meta.currentRelease}.${meta.currentBundle}`
    : null;
  const tryLabel = meta
    ? `v.${meta.currentRelease}.${meta.currentBundle}.${meta.currentTry}`
    : null;

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-logo" title="DREAMTEAM">
          DT
        </div>
        <nav className="rail-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rail-btn${view === item.id ? " active" : ""}`}
              disabled={item.needsProject && !activeProject}
              onClick={() => setView(item.id)}
              title={item.label}
            >
              <span className="rail-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div
          className={`rail-footer${ollamaOk ? " ok" : ""}`}
          title={ollamaOk ? "Ollama connected" : "Ollama disconnected — click status in top bar"}
        >
          <span className="dot" />
        </div>
      </aside>

      <header className="topbar">
        <div className="topbar-brand">DREAMTEAM</div>
        <div className="topbar-center">
          {activeProject ? (
            <>
              Agent · <strong>{activeProject}</strong>
            </>
          ) : (
            "Select or create a project"
          )}
        </div>
        <div className="topbar-status-wrap">
          <button
            type="button"
            className={`topbar-status${ollamaOk ? " ok" : " disconnected"}`}
            onClick={() => setOllamaHintOpen((v) => !v)}
            aria-expanded={ollamaHintOpen}
          >
            <span className="dot" />
            {ollamaOk ? "Ollama connected" : "Ollama disconnected"}
          </button>
          {ollamaHintOpen && (
            <div className="ollama-hint" role="dialog" aria-label="Ollama help">
              {ollamaOk ? (
                <p>
                  Ollama is reachable from the app. Model: <code>{ollamaModel}</code>.
                </p>
              ) : (
                <>
                  <p className="ollama-hint-title">Host Ollama required</p>
                  <p>
                    The app runs in Podman; the model stays on the <strong>host</strong> (
                    {hostOs}). Install and start Ollama on this machine, then refresh.
                  </p>
                  <ol>
                    <li>
                      Install from <code>https://ollama.com</code> (or package manager).
                    </li>
                    <li>
                      Start the server: <code>ollama serve</code>
                    </li>
                    <li>
                      Pull the model: <code>ollama pull {ollamaModel}</code>
                    </li>
                    <li>Click this status again or reload the page.</li>
                  </ol>
                </>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setOllamaHintOpen(false);
                  void refresh();
                }}
              >
                Close / recheck
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        {view === "projects" && (
          <div className="panel-view">
            <div className="panel">
              <h2>Projects</h2>
              <div className="row">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Project name"
                />
                <button type="button" className="btn-primary" onClick={handleCreateProject}>
                  Create
                </button>
              </div>
              <ul className="artifact-list">
                {projects.map((p) => (
                  <li
                    key={p}
                    className={activeProject === p ? "active" : undefined}
                    onClick={() => {
                      setActiveProject(p);
                      setMessages([]);
                      setView("chat");
                    }}
                  >
                    {p}
                    {activeProject === p ? " · active" : ""}
                  </li>
                ))}
                {projects.length === 0 && (
                  <li style={{ cursor: "default", color: "var(--text-dim)" }}>
                    No projects yet
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {view === "chat" && activeProject && (
          <div className="agent-surface">
            <div className="chat-log">
              {messages.length === 0 && (
                <p className="chat-empty">
                  Describe what to build. Designer will draft a high-level design, then you can
                  Approve, Retry, or Restart.
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>
                  <span className="msg-meta">{m.role === "user" ? "You" : "Agent"}</span>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="composer">
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what to build… (also used for Restart design)"
                disabled={loading}
              />
              <div className="composer-toolbar">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSendPrompt}
                  disabled={loading}
                >
                  Send
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleApprove}
                  disabled={loading}
                >
                  Approve design
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleRetryDesign}
                  disabled={loading}
                >
                  Retry design
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleRestartDesign}
                  disabled={loading}
                >
                  Restart design
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "artifacts" && activeProject && (
          <div className="panel-view">
            <div className="grid-2">
              <div className="panel">
                <h2>Artifacts</h2>
                <ul className="artifact-list">
                  {artifacts.map((a) => (
                    <li
                      key={a}
                      className={selectedArtifact === a ? "active" : undefined}
                      onClick={() => handleSelectArtifact(a)}
                    >
                      {a}
                    </li>
                  ))}
                  {artifacts.length === 0 && (
                    <li style={{ cursor: "default", color: "var(--text-dim)" }}>
                      No artifacts in current attempt
                    </li>
                  )}
                </ul>
              </div>
              <div className="panel">
                <h2>{selectedArtifact ?? "Select an artifact"}</h2>
                <pre className="artifact-content">{artifactContent}</pre>
              </div>
            </div>
          </div>
        )}

        {view === "trace" && activeProject && (
          <div className="panel-view">
            <div className="panel">
              <h2>Trace — {activeProject}</h2>
              {trace.map((e, i) => (
                <div key={i} className="trace-event">
                  <span className="status-ok">{e.ts}</span>{" "}
                  <strong>{e.actor}</strong> — {e.event}
                  {e.path && <span> → {e.path}</span>}
                </div>
              ))}
              {trace.length === 0 && <p className="status-err" style={{ color: "var(--text-dim)" }}>No trace events yet.</p>}
            </div>
          </div>
        )}
      </main>

      <aside className="context">
        {!activeProject || !meta ? (
          <p className="context-empty">
            Open a project to see version chips, pipeline progress, and latest artifacts.
          </p>
        ) : (
          <>
            <div className="context-section">
              <h3>Project</h3>
              <p className="context-project-name">{meta.name}</p>
              <p className="context-path">projects/{meta.name}</p>
            </div>

            <div className="context-section">
              <h3>Versions</h3>
              <div className="version-chips">
                <span className="chip">{releaseLabel}</span>
                <span className="chip">{bundleLabel}</span>
                <span className="chip active">{tryLabel}</span>
              </div>
            </div>

            <div className="context-section">
              <h3>Pipeline</h3>
              <div className="pipeline">
                {PIPELINE.map((agent) => {
                  const isDone = progress.done.has(agent);
                  const isCurrent = progress.current === agent;
                  return (
                    <div
                      key={agent}
                      className={`pipeline-step${isDone ? " done" : ""}${isCurrent ? " current" : ""}`}
                    >
                      <span className="step-mark" />
                      {agent}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="context-section">
              <h3>Current gate</h3>
              <p
                className={`gate-label${
                  progress.gate === "waiting_user"
                    ? ""
                    : progress.gate === "agent_running"
                      ? " running"
                      : " idle"
                }`}
              >
                {progress.gate}
              </p>
            </div>

            <div className="context-section">
              <h3>Context</h3>
              <ul className="context-meta-list">
                <li>
                  <span>model</span>
                  <span>{ollamaModel}</span>
                </li>
                <li>
                  <span>provider</span>
                  <span>ollama</span>
                </li>
                <li>
                  <span>status</span>
                  <span>{ollamaOk ? "online" : "offline"}</span>
                </li>
              </ul>
            </div>

            <div className="context-section">
              <h3>Artifacts (latest)</h3>
              <ul className="artifact-list">
                {artifacts.slice(0, 8).map((a) => (
                  <li
                    key={a}
                    onClick={() => {
                      setView("artifacts");
                      void handleSelectArtifact(a);
                    }}
                  >
                    {a.split("/").pop()}
                  </li>
                ))}
                {artifacts.length === 0 && (
                  <li style={{ cursor: "default", color: "var(--text-dim)" }}>—</li>
                )}
              </ul>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
