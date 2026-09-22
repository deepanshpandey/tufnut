// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter provider — calls the OpenAI-compatible API at openrouter.ai.
// Allows access to many models via a single API key.
// The user's API key is stored locally and only sent to openrouter.ai.
// ─────────────────────────────────────────────────────────────────────────────

import type { AICompletionRequest, AICompletionResponse } from "@/types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export async function callOpenRouter(
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const { config, systemPrompt, messages } = request;

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    max_tokens: 512,
    temperature: 0.7,
  };

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${config.apiKey}`,
        "HTTP-Referer":  "https://github.com/tufnut",
        "X-Title":       "Tufnut Socratic DSA Tutor",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { error?: { message?: string } })?.error?.message ??
        `HTTP ${response.status}`;
      return { content: "", error: `OpenRouter error: ${message}` };
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return { content };
  } catch (err) {
    return {
      content: "",
      error: `Network error calling OpenRouter: ${String(err)}`,
    };
  }
}
