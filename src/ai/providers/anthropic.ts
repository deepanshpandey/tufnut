// ─────────────────────────────────────────────────────────────────────────────
// Anthropic provider — calls the Messages API directly from the browser.
// The user's API key is stored locally and only sent to api.anthropic.com.
// ─────────────────────────────────────────────────────────────────────────────

import type { AICompletionRequest, AICompletionResponse } from "@/types";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION   = "2023-06-01";

export async function callAnthropic(
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const { config, systemPrompt, messages } = request;

  // Anthropic requires alternating user/assistant turns.
  // Filter out any system messages from the history (system is a top-level field).
  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Anthropic requires the first message to be from "user"
  if (anthropicMessages.length === 0 || anthropicMessages[0].role !== "user") {
    return { content: "", error: "Anthropic requires at least one user message." };
  }

  const body = {
    model: config.model,
    max_tokens: 512,
    system: systemPrompt,
    messages: anthropicMessages,
  };

  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         config.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        // Required for browser-based calls to the Anthropic API
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { error?: { message?: string } })?.error?.message ??
        `HTTP ${response.status}`;
      return { content: "", error: `Anthropic error: ${message}` };
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };
    const textBlock = data.content?.find((b) => b.type === "text");
    return { content: textBlock?.text ?? "" };
  } catch (err) {
    return {
      content: "",
      error: `Network error calling Anthropic: ${String(err)}`,
    };
  }
}
