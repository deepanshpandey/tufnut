// ─────────────────────────────────────────────────────────────────────────────
// Settings storage — wraps chrome.storage.local for type-safe access.
//
// API keys are stored locally in the extension and are NEVER sent to any
// server other than the AI provider the user explicitly configures.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExtensionSettings, AIProvider } from "@/types";
import { DEFAULT_SETTINGS, DEFAULT_MODELS } from "@/types";

const SETTINGS_KEY = "tufnut_settings";

// ── Read ──────────────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (result: Record<string, unknown>) => {
      const stored = result[SETTINGS_KEY];
      if (stored && typeof stored === "object") {
        resolve({ ...DEFAULT_SETTINGS, ...stored } as ExtensionSettings);
      } else {
        resolve({ ...DEFAULT_SETTINGS });
      }
    });
  });
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function saveSettings(
  settings: Partial<ExtensionSettings>
): Promise<void> {
  const current = await loadSettings();
  const merged: ExtensionSettings = { ...current, ...settings };
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: merged }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/**
 * Change the active provider and automatically reset the model to its default
 * so the user never ends up with a model that belongs to a different provider.
 */
export async function setProvider(provider: AIProvider): Promise<void> {
  await saveSettings({ aiProvider: provider, model: DEFAULT_MODELS[provider] });
}

/**
 * Store only the API key without touching other settings.
 * Keys are written exclusively to chrome.storage.local — they never leave the
 * device except in requests the user initiates to their chosen AI provider.
 */
export async function setApiKey(apiKey: string): Promise<void> {
  await saveSettings({ apiKey });
}

/**
 * Remove all stored settings (useful for a "Reset" button).
 */
export async function clearSettings(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(SETTINGS_KEY, resolve);
  });
}
