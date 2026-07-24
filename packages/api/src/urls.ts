/**
 * Service URL aliases. Prefer env vars; never hardcode advertised hostnames in docs.
 * Defaults use loopback by numeric port only when the alias env is unset.
 */
function loopbackUrl(portEnv: string, defaultPort: number): string {
  const port = Number(process.env[portEnv] ?? defaultPort);
  return `http://127.0.0.1:${port}`;
}

/** API base URL alias (`API_URL`), e.g. used by the web dev proxy. */
export function apiUrl(): string {
  return process.env.API_URL?.trim() || loopbackUrl("API_PORT", 3001);
}

/** Ollama base URL alias (`OLLAMA_URL`). */
export function ollamaUrl(): string {
  return process.env.OLLAMA_URL?.trim() || loopbackUrl("OLLAMA_PORT", 11434);
}

export function ollamaModel(): string {
  return process.env.OLLAMA_MODEL?.trim() || "llama3.2";
}

export function apiListenPort(): number {
  return Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
}
