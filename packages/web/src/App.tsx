import { useCallback, useEffect, useState } from "react";
import {
  approveDesign,
  createProject,
  getArtifact,
  getHealth,
  getProject,
  getTrace,
  listArtifacts,
  listProjects,
  newBundle,
  retryTry,
  sendPrompt,
  type ProjectMeta,
  type TraceEvent,
} from "./api";

type View = "chat" | "artifacts" | "trace" | "projects";

interface ChatMessage {
  role: "user" | "system";
  text: string;
}

export default function App() {
  const [view, setView] = useState<View>("projects");
  const [projects, setProjects] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [meta, setMeta] = useState<ProjectMeta | null>(null);
  const [ollamaOk, setOllamaOk] = useState(false);
  const [newName, setNewName] = useState("ProjectX");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [artifactContent, setArtifactContent] = useState("");
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const health = await getHealth();
    setOllamaOk(health.ollama);
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

  async function handleCreateProject() {
    if (!newName.trim()) return;
    const m = await createProject(newName.trim());
    setActiveProject(m.name);
    setMeta(m);
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

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>AI SDLC DREAMTEAM</h1>
        <p className={ollamaOk ? "status-ok" : "status-err"}>
          Ollama: {ollamaOk ? "connected" : "offline"}
        </p>
        {meta && (
          <p style={{ fontSize: "0.8rem", color: "#9ca3b8" }}>
            {meta.name} / v.{meta.currentRelease} / v.{meta.currentRelease}.{meta.currentBundle} / v.{meta.currentRelease}.{meta.currentBundle}.{meta.currentTry}
          </p>
        )}
        <nav>
          <button onClick={() => setView("projects")}>Projects</button>
          <button onClick={() => setView("chat")} disabled={!activeProject}>
            Chat
          </button>
          <button onClick={() => setView("artifacts")} disabled={!activeProject}>
            Artifacts
          </button>
          <button onClick={() => setView("trace")} disabled={!activeProject}>
            Trace
          </button>
        </nav>
      </aside>

      <main className="main">
        {view === "projects" && (
          <div className="panel">
            <h2>Projects</h2>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
              />
              <button onClick={handleCreateProject}>Create</button>
            </div>
            <ul className="artifact-list">
              {projects.map((p) => (
                <li
                  key={p}
                  onClick={() => {
                    setActiveProject(p);
                    setView("chat");
                  }}
                >
                  {p} {activeProject === p ? "(active)" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {view === "chat" && activeProject && (
          <div className="panel">
            <h2>Chat — {activeProject}</h2>
            <div className="chat-log">
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>
                  <strong>{m.role}:</strong> {m.text}
                </div>
              ))}
            </div>
            <textarea
              rows={3}
              style={{ width: "100%", marginBottom: "0.5rem" }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what to build..."
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={handleSendPrompt} disabled={loading}>
                Send prompt
              </button>
              <button onClick={handleApprove} disabled={loading}>
                Approve design
              </button>
              <button
                onClick={async () => {
                  await retryTry(activeProject);
                  await refresh();
                }}
              >
                Retry design
              </button>
              <button
                onClick={async () => {
                  await newBundle(activeProject);
                  await refresh();
                }}
              >
                Restart design
              </button>
            </div>
          </div>
        )}

        {view === "artifacts" && activeProject && (
          <div className="grid-2">
            <div className="panel">
              <h2>Artifacts</h2>
              <ul className="artifact-list">
                {artifacts.map((a) => (
                  <li key={a} onClick={() => handleSelectArtifact(a)}>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h2>{selectedArtifact ?? "Select an artifact"}</h2>
              <pre className="artifact-content">{artifactContent}</pre>
            </div>
          </div>
        )}

        {view === "trace" && activeProject && (
          <div className="panel">
            <h2>Trace — {activeProject}</h2>
            {trace.map((e, i) => (
              <div key={i} className="trace-event">
                <span className="status-ok">{e.ts}</span>{" "}
                <strong>{e.actor}</strong> — {e.event}
                {e.path && <span> → {e.path}</span>}
              </div>
            ))}
            {trace.length === 0 && <p>No trace events yet.</p>}
          </div>
        )}
      </main>
    </div>
  );
}
