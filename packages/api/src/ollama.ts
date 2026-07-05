export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(
  config: OllamaConfig,
  messages: ChatMessage[],
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

export async function checkOllama(config: OllamaConfig): Promise<boolean> {
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}
