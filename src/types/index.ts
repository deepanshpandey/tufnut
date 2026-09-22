// ─────────────────────────────────────────────────────────────────────────────
// Core shared types for Tufnut
// ─────────────────────────────────────────────────────────────────────────────

// ── Problem context extracted from the page ──────────────────────────────────

export interface ProblemContext {
  title?: string;
  statement?: string;
  examples?: string;
  constraints?: string;
  code?: string;
  language?: string;
  url: string;
  extractedBy?: string; // which extractor succeeded
}

// ── Chat messages ─────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp: number;
}

// ── Hint levels ───────────────────────────────────────────────────────────────

export type HintLevel = 0 | 1 | 2 | 3 | 4;

export const HINT_LEVEL_LABELS: Record<HintLevel, string> = {
  0: "Socratic Question",
  1: "Directional Hint",
  2: "Conceptual Hint",
  3: "Strong Hint",
  4: "Confirmation",
};

// ── Conversation state (persisted per-tab session) ────────────────────────────

export interface ConversationState {
  problemContext: ProblemContext | null;
  messages: ChatMessage[];
  hintLevel: HintLevel;
  userApproach: string;
  sessionId: string;
}

// ── AI provider configuration ─────────────────────────────────────────────────

export type AIProvider = "openai" | "anthropic" | "gemini" | "openrouter" | "ollama";

export interface AIProviderConfig {
  provider:   AIProvider;
  apiKey:     string;
  model:      string;
  /** Only used by the Ollama provider. Defaults to http://localhost:11434 */
  ollamaUrl?: string;
}

// Sensible default models per provider
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai:     "gpt-4o-mini",
  anthropic:  "claude-3-5-haiku-20241022",
  gemini:     "gemini-2.0-flash",
  openrouter: "openai/gpt-4o-mini",
  ollama:     "llama3.2",
};

// Model options surfaced in the settings UI.
// Users can always type a custom model string in the "Custom model" field.
// Ollama models are also fetched dynamically from /api/tags.
export const MODEL_OPTIONS: Record<AIProvider, string[]> = {
  openai:     ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic:  [
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
  ],
  gemini: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ],
  openrouter: [
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "anthropic/claude-3.5-haiku",
    "google/gemini-flash-1.5",
    "meta-llama/llama-3.1-8b-instruct:free",
  ],
  // Populated dynamically by fetching /api/tags from the local Ollama server
  ollama:     ["llama3.2", "llama3.1", "mistral", "codellama", "deepseek-coder-v2"],
};

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

// ── Extension settings (stored in chrome.storage.local) ──────────────────────

export interface ExtensionSettings {
  aiProvider: AIProvider;
  apiKey:     string;
  model:      string;
  theme:      "system" | "light" | "dark";
  /** Base URL for a local Ollama instance. Only used when aiProvider === "ollama" */
  ollamaUrl:  string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  aiProvider: "openai",
  apiKey:     "",
  model:      DEFAULT_MODELS["openai"],
  theme:      "system",
  ollamaUrl:  DEFAULT_OLLAMA_URL,
};

// ── Messages between content script ↔ background ↔ sidepanel ─────────────────

export type ExtensionMessageType =
  | "EXTRACT_PROBLEM"
  | "PROBLEM_EXTRACTED"
  | "EXTRACTION_FAILED"
  | "REQUEST_CODE"
  | "CODE_RESULT"
  | "OPEN_SIDE_PANEL"
  | "GET_SETTINGS"
  | "SAVE_SETTINGS"
  | "PING";

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: unknown;
}

// ── AI completion request / response ─────────────────────────────────────────

export interface AICompletionRequest {
  messages: ChatMessage[];
  systemPrompt: string;
  config: AIProviderConfig;
}

export interface AICompletionResponse {
  content: string;
  error?: string;
}

// ── Spoiler guard result ──────────────────────────────────────────────────────

export interface SpoilerCheckResult {
  hasSpoiler: boolean;
  reason?: string;
}

// ── Debug log entries (shown in the Logs panel) ───────────────────────────────

export type LogLevel = "info" | "success" | "warn" | "error";

export interface LogEntry {
  id:        string;      // crypto.randomUUID()
  timestamp: number;      // Date.now()
  level:     LogLevel;
  tag:       string;      // short category label, e.g. "Extractor", "AI", "Spoiler"
  message:   string;      // one-line summary
  detail?:   string;      // optional multi-line detail (stack trace, raw response)
}
