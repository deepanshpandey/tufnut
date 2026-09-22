// ─────────────────────────────────────────────────────────────────────────────
// OpenAI provider — calls the Chat Completions API directly from the browser.
// The user's API key is read from chrome.storage.local and is never forwarded
// to any server other than api.openai.com.
// ─────────────────────────────────────────────────────────────────────────────

import type { AICompletionRequest, AICompletionResponse } from "@/types";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export async function callOpenAI(
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const { config, systemPrompt, messages } = request;

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    max_tokens: 4096,
    temperature: 0.7,
  };

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { error?: { message?: string } })?.error?.message ??
        `HTTP ${response.status}`;
      return { content: "", error: `OpenAI error: ${message}` };
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return { content };
  } catch (err) {
    return {
      content: "",
      error: `Network error calling OpenAI: ${String(err)}`,
    };
  }
}
