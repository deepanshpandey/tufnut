// ─────────────────────────────────────────────────────────────────────────────
// Ollama provider — calls a locally-running Ollama instance.
//
// Ollama exposes an OpenAI-compatible /api/chat endpoint.
// The default base URL is http://localhost:11434 but the user can override it
// in settings to point at any Ollama server (e.g. a remote host or a different
// port).
//
// No API key is required for a standard local Ollama installation.
// ─────────────────────────────────────────────────────────────────────────────

import type { AICompletionRequest, AICompletionResponse } from "@/types";
import { DEFAULT_OLLAMA_URL } from "@/types";

export async function callOllama(
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const { config, systemPrompt, messages } = request;

  const baseUrl = (config.ollamaUrl ?? DEFAULT_OLLAMA_URL).replace(/\/$/, "");

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: false,
  };

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => `HTTP ${response.status}`);
      return { content: "", error: `Ollama error (${response.status}): ${text}` };
    }

    const data = (await response.json()) as {
      message?: { content: string };
    };

    const content = data.message?.content ?? "";
    return { content };
  } catch (err) {
    const msg = String(err);
    // Give a more helpful error for the most common failure mode
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return {
        content: "",
        error:   `Cannot reach Ollama at ${baseUrl}. Is Ollama running? (ollama serve)`,
      };
    }
    return { content: "", error: `Ollama error: ${msg}` };
  }
}

// ── List available local models ───────────────────────────────────────────────

/**
 * Fetch the list of locally pulled models from the Ollama /api/tags endpoint.
 * Returns an empty array if the server is unreachable (so the UI degrades
 * gracefully with the static fallback list).
 */
export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return [];
    const data = (await response.json()) as {
      models?: { name: string }[];
    };
    return data.models?.map((m) => m.name) ?? [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}
