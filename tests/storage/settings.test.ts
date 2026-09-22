// ─────────────────────────────────────────────────────────────────────────────
// Tests: settings storage (mocks chrome.storage.local)
// ─────────────────────────────────────────────────────────────────────────────

import { loadSettings, saveSettings, clearSettings } from "../../src/storage/settings";
import type { ExtensionSettings } from "../../src/types";
import { DEFAULT_SETTINGS } from "../../src/types";

// ── Chrome storage mock ───────────────────────────────────────────────────────

const mockStore: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: jest.fn((key: string, cb: (r: Record<string, unknown>) => void) => {
        cb({ [key]: mockStore[key] });
      }),
      set: jest.fn((data: Record<string, unknown>, cb: () => void) => {
        Object.assign(mockStore, data);
        cb();
      }),
      remove: jest.fn((key: string, cb: () => void) => {
        delete mockStore[key];
        cb();
      }),
    },
  },
  runtime: {
    lastError: undefined,
  },
} as unknown as typeof chrome;

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("loadSettings", () => {
  beforeEach(() => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
    jest.clearAllMocks();

    // Re-bind mock functions to clear stale data
    (chrome.storage.local.get as jest.Mock).mockImplementation(
      (key: string, cb: (r: Record<string, unknown>) => void) => {
        cb({ [key]: mockStore[key] });
      }
    );
    (chrome.storage.local.set as jest.Mock).mockImplementation(
      (data: Record<string, unknown>, cb: () => void) => {
        Object.assign(mockStore, data);
        cb();
      }
    );
    (chrome.storage.local.remove as jest.Mock).mockImplementation(
      (key: string, cb: () => void) => {
        delete mockStore[key];
        cb();
      }
    );
  });

  it("returns DEFAULT_SETTINGS when nothing is stored", async () => {
    const settings = await loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("merges stored values over defaults", async () => {
    const stored: Partial<ExtensionSettings> = {
      aiProvider: "anthropic",
      apiKey:     "test-key-123",
      model:      "claude-3-5-haiku-20241022",
    };
    mockStore["tufnut_settings"] = stored;
    const settings = await loadSettings();
    expect(settings.aiProvider).toBe("anthropic");
    expect(settings.apiKey).toBe("test-key-123");
    // Default fields not in stored should still be present
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });
});

describe("saveSettings", () => {
  it("persists a partial update without losing other fields", async () => {
    mockStore["tufnut_settings"] = { ...DEFAULT_SETTINGS, apiKey: "original" };
    await saveSettings({ model: "gpt-4o" });
    const settings = await loadSettings();
    expect(settings.model).toBe("gpt-4o");
    expect(settings.apiKey).toBe("original");
  });
});

describe("clearSettings", () => {
  it("removes the settings key", async () => {
    mockStore["tufnut_settings"] = { ...DEFAULT_SETTINGS };
    await clearSettings();
    const settings = await loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});
