// ─────────────────────────────────────────────────────────────────────────────
// Tutor orchestrator — the single entry point for getting a Socratic response.
//
// Responsibilities:
//   1. Build the system prompt from current conversation state.
//   2. Call the appropriate AI provider.
//   3. Run the spoiler guard.
//   4. Regenerate if spoilers are detected (up to MAX_REGENERATION_ATTEMPTS).
//   5. Return the final clean response.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig,
  ChatMessage,
  ConversationState,
  HintLevel,
} from "@/types";
import { buildSystemPrompt, SPOILER_REGENERATION_PROMPT } from "./prompts";
import { checkForSpoilers, MAX_REGENERATION_ATTEMPTS }    from "./spoilerGuard";
import { callOpenAI }      from "./providers/openai";
import { callAnthropic }   from "./providers/anthropic";
import { callGemini }      from "./providers/gemini";
import { callOpenRouter }  from "./providers/openrouter";
import { callOllama }      from "./providers/ollama";

// ── Provider dispatch ─────────────────────────────────────────────────────────

async function callProvider(
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  switch (request.config.provider) {
    case "openai":     return callOpenAI(request);
    case "anthropic":  return callAnthropic(request);
    case "gemini":     return callGemini(request);
    case "openrouter": return callOpenRouter(request);
    case "ollama":     return callOllama(request);
    default: {
      // TypeScript exhaustiveness check
      const _: never = request.config.provider;
      return { content: "", error: `Unknown provider: ${String(_)}` };
    }
  }
}

// ── Connection test (called from settings page) ───────────────────────────────

export async function testConnection(
  config: AIProviderConfig
): Promise<{ ok: boolean; error?: string }> {
  const testMessage: ChatMessage = {
    role:      "user",
    content:   "Reply with exactly: OK",
    timestamp: Date.now(),
  };
  const request: AICompletionRequest = {
    config,
    systemPrompt: "You are a test assistant. Follow instructions exactly.",
    messages:     [testMessage],
  };
  const response = await callProvider(request);
  if (response.error) return { ok: false, error: response.error };
  return { ok: true };
}

// ── Main tutor function ───────────────────────────────────────────────────────

export interface TutorRequest {
  state:         ConversationState;
  userMessage:   string;
  config:        AIProviderConfig;
  /**
   * Pass true when the user clicked "Small Hint" or "Stronger Hint" —
   * the tutor will factor the current hint level into the system prompt.
   */
  isHintRequest?: boolean;
}

export interface TutorResponse {
  message:    string;
  error?:     string;
  wasSpoiler: boolean;
}

export async function askTutor(request: TutorRequest): Promise<TutorResponse> {
  const { state, userMessage, config } = request;

  // Build the conversation history that will be sent to the model.
  // We include the full history so the model has conversation context.
  const historyMessages: ChatMessage[] = [...state.messages];

  // Append the current user message
  const newUserMsg: ChatMessage = {
    role:      "user",
    content:   userMessage,
    timestamp: Date.now(),
  };
  historyMessages.push(newUserMsg);

  const systemPrompt = buildSystemPrompt({
    problem:             state.problemContext,
    userApproach:        state.userApproach,
    hintLevel:           state.hintLevel,
    conversationHistory: state.messages, // prior turns only, not the new message
  });

  let attempt = 0;
  let lastResponse: AICompletionResponse = { content: "" };
  let wasSpoiler = false;
  let messagesForRequest = historyMessages;

  while (attempt <= MAX_REGENERATION_ATTEMPTS) {
    const completionRequest: AICompletionRequest = {
      config,
      systemPrompt,
      messages: messagesForRequest,
    };

    lastResponse = await callProvider(completionRequest);

    if (lastResponse.error) {
      return { message: "", error: lastResponse.error, wasSpoiler: false };
    }

    const spoilerCheck = checkForSpoilers(lastResponse.content);

    if (!spoilerCheck.hasSpoiler) {
      // Clean response — return it
      return {
        message:    lastResponse.content,
        wasSpoiler: attempt > 0, // true if we had to regenerate
      };
    }

    // Spoiler detected — ask the model to retry with a stricter instruction
    wasSpoiler = true;
    console.warn(
      `[tufnut] Spoiler detected on attempt ${attempt + 1}: ${spoilerCheck.reason}`
    );

    // Inject regeneration instruction as an assistant + user turn
    messagesForRequest = [
      ...historyMessages,
      { role: "assistant", content: lastResponse.content, timestamp: Date.now() },
      {
        role:      "user",
        content:   SPOILER_REGENERATION_PROMPT,
        timestamp: Date.now(),
      },
    ];

    attempt++;
  }

  // After all attempts still had spoilers, return a safe fallback
  return {
    message: "Let me ask you this: what is the first thing you would do to understand this problem better?",
    wasSpoiler,
  };
}

// ── Hint level management ─────────────────────────────────────────────────────

export function increaseHintLevel(current: HintLevel): HintLevel {
  return Math.min(current + 1, 4) as HintLevel;
}

export function resetHintLevel(): HintLevel {
  return 0;
}
