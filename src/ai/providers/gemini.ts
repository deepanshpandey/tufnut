// ─────────────────────────────────────────────────────────────────────────────
// Google Gemini provider — uses the official @google/genai SDK.
//
// The user's API key is stored locally in chrome.storage.local and is only
// sent to generativelanguage.googleapis.com via the SDK.
//
// SDK reference:
//   ai.models.generateContent({ model, contents, config })
//   response.text  ← concatenated text from the first candidate
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from "@google/genai";
import type { AICompletionRequest, AICompletionResponse } from "@/types";

export async function callGemini(
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const { config, systemPrompt, messages } = request;

  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  // Map our internal ChatMessage[] to the SDK's Content[] format.
  // Gemini roles are "user" | "model" (not "assistant").
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role:  m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  // Gemini requires the last turn to be from "user"
  if (contents.length === 0 || contents[contents.length - 1].role !== "user") {
    return { content: "", error: "Gemini requires the last message to be from user." };
  }

  try {
    const response = await ai.models.generateContent({
      model:    config.model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens:   512,
        temperature:       0.7,
      },
    });

    // response.text is the SDK's convenience accessor — concatenates all text parts
    return { content: response.text ?? "" };
  } catch (err) {
    // The SDK throws ApiError for non-OK responses
    const msg = err instanceof Error ? err.message : String(err);
    return { content: "", error: `Gemini error: ${msg}` };
  }
}
