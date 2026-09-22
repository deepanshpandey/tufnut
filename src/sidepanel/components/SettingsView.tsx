// ─────────────────────────────────────────────────────────────────────────────
// SettingsView — configure AI provider, API key, and model.
//
// Ollama is treated as a special case:
//   - No API key is required (field is hidden)
//   - A "Base URL" field is shown instead (default: http://localhost:11434)
//   - Available models are fetched live from the Ollama /api/tags endpoint
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import type { ExtensionSettings, AIProvider } from "@/types";
import {
  DEFAULT_SETTINGS,
  DEFAULT_MODELS,
  MODEL_OPTIONS,
  DEFAULT_OLLAMA_URL,
} from "@/types";
import { saveSettings }   from "@/storage/settings";
import { testConnection } from "@/ai/tutor";
import { listOllamaModels } from "@/ai/providers/ollama";

interface Props {
  initialSettings?: ExtensionSettings;
  onSaved: (settings: ExtensionSettings) => void;
  onBack:  () => void;
}

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: "openai",     label: "OpenAI" },
  { value: "anthropic",  label: "Anthropic" },
  { value: "gemini",     label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama",     label: "Ollama (local)" },
];

export default function SettingsView({ initialSettings, onSaved, onBack }: Props): React.JSX.Element {
  const base = initialSettings ?? DEFAULT_SETTINGS;

  const [provider,    setProvider]    = useState<AIProvider>(base.aiProvider);
  const [apiKey,      setApiKey]      = useState(base.apiKey);
  const [model,       setModel]       = useState(base.model);
  const [customModel, setCustomModel] = useState("");
  const [ollamaUrl,   setOllamaUrl]   = useState(base.ollamaUrl ?? DEFAULT_OLLAMA_URL);
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [testResult,  setTestResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // Dynamic Ollama model list
  const [ollamaModels,   setOllamaModels]   = useState<string[]>(MODEL_OPTIONS.ollama);
  const [fetchingModels, setFetchingModels] = useState(false);

  const isOllama = provider === "ollama";

  // The model that will actually be used: custom input wins over dropdown
  const effectiveModel = customModel.trim() || model;

  // When switching to Ollama, try to fetch available local models immediately
  useEffect(() => {
    if (!isOllama) return;
    fetchOllamaModels(ollamaUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOllama]);

  async function fetchOllamaModels(url: string) {
    setFetchingModels(true);
    const models = await listOllamaModels(url);
    setFetchingModels(false);
    if (models.length > 0) {
      setOllamaModels(models);
      // If current model isn't in the fetched list, default to first
      if (!models.includes(model)) setModel(models[0]);
    }
  }

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    setModel(DEFAULT_MODELS[p]);
    setCustomModel("");
    setTestResult(null);
  };

  const handleSave = async () => {
    // API key is required for all providers except Ollama
    if (!isOllama && !apiKey.trim()) {
      setError("API key is required.");
      return;
    }
    if (!effectiveModel.trim()) {
      setError("Model is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated: ExtensionSettings = {
        aiProvider: provider,
        apiKey:     isOllama ? "" : apiKey.trim(),
        model:      effectiveModel,   // save whichever is active: custom or dropdown
        theme:      base.theme ?? "system",
        ollamaUrl:  ollamaUrl.trim() || DEFAULT_OLLAMA_URL,
      };
      await saveSettings(updated);
      onSaved(updated);
    } catch (err) {
      setError(`Failed to save settings: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!isOllama && !apiKey.trim()) {
      setTestResult({ ok: false, msg: "Enter your API key first." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection({
        provider,
        apiKey:    isOllama ? "" : apiKey.trim(),
        model:     effectiveModel,    // use effective model for connection test too
        ollamaUrl: isOllama ? ollamaUrl.trim() : undefined,
      });
      setTestResult({
        ok:  result.ok,
        msg: result.ok ? "Connection successful ✓" : (result.error ?? "Connection failed"),
      });
    } catch (err) {
      setTestResult({ ok: false, msg: String(err) });
    } finally {
      setTesting(false);
    }
  };

  // The model list to show in the dropdown
  const modelList = isOllama ? ollamaModels : MODEL_OPTIONS[provider];

  return (
    <div className="settings-view">
      {/* ── Header ── */}
      <div className="settings-view__header">
        <button
          className="settings-view__back-btn"
          onClick={onBack}
          aria-label="Back to tutor"
        >
          ← Back
        </button>
        <h2 className="settings-view__title">Settings</h2>
      </div>

      <div className="settings-view__body">

        {/* ── Provider ── */}
        <div className="settings-view__field">
          <label htmlFor="provider-select" className="settings-view__label">
            AI Provider
          </label>
          <select
            id="provider-select"
            className="settings-view__select"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Ollama URL (only when Ollama is selected) ── */}
        {isOllama && (
          <div className="settings-view__field">
            <label htmlFor="ollama-url-input" className="settings-view__label">
              Ollama Base URL
            </label>
            <div className="settings-view__ollama-url-row">
              <input
                id="ollama-url-input"
                type="url"
                className="settings-view__input"
                value={ollamaUrl}
                onChange={(e) => { setOllamaUrl(e.target.value); setTestResult(null); }}
                placeholder="http://localhost:11434"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="settings-view__refresh-btn"
                onClick={() => fetchOllamaModels(ollamaUrl)}
                disabled={fetchingModels}
                title="Refresh model list from Ollama"
                aria-label="Refresh Ollama models"
              >
                {fetchingModels ? "…" : "↺"}
              </button>
            </div>
            <p className="settings-view__hint">
              Make sure Ollama is running: <code>ollama serve</code>
            </p>
          </div>
        )}

        {/* ── API Key (hidden for Ollama) ── */}
        {!isOllama && (
          <div className="settings-view__field">
            <label htmlFor="api-key-input" className="settings-view__label">
              API Key
            </label>
            <input
              id="api-key-input"
              type="password"
              className="settings-view__input"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
              placeholder={`Enter your ${provider} API key`}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        {/* ── Model ── */}
        <div className="settings-view__field">
          <label htmlFor="model-select" className="settings-view__label">
            Model
            {isOllama && fetchingModels && (
              <span className="settings-view__fetching"> (fetching…)</span>
            )}
          </label>
          <select
            id="model-select"
            className="settings-view__select"
            value={model}
            onChange={(e) => { setModel(e.target.value); setCustomModel(""); }}
          >
            {modelList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* ── Custom model override ── */}
        <div className="settings-view__field">
          <label htmlFor="custom-model-input" className="settings-view__label">
            Custom model
            {customModel.trim() && (
              <span className="settings-view__active-badge">active</span>
            )}
          </label>
          <input
            id="custom-model-input"
            type="text"
            className="settings-view__input"
            value={customModel}
            onChange={(e) => { setCustomModel(e.target.value); setTestResult(null); }}
            placeholder={`e.g. ${model} (overrides dropdown)`}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="settings-view__hint">
            Type any model string to use it instead of the dropdown selection.
            {customModel.trim() && (
              <> Using: <strong>{customModel.trim()}</strong></>
            )}
          </p>
        </div>

        {/* ── Test connection ── */}
        <button
          className="settings-view__test-btn"
          onClick={handleTestConnection}
          disabled={testing || (!isOllama && !apiKey.trim())}
        >
          {testing ? "Testing…" : "Test Connection"}
        </button>

        {testResult && (
          <p
            className={`settings-view__test-result settings-view__test-result--${testResult.ok ? "ok" : "err"}`}
          >
            {testResult.msg}
          </p>
        )}

        {error && <p className="settings-view__error">{error}</p>}

        {/* ── Save ── */}
        <button
          className="settings-view__save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>

        {/* ── Privacy notice ── */}
        <div className="settings-view__privacy">
          <h3 className="settings-view__privacy-title">Privacy</h3>
          {isOllama ? (
            <p>
              You are using a local Ollama instance. Your code and problem
              context are sent only to <strong>{ollamaUrl || DEFAULT_OLLAMA_URL}</strong> — they
              never leave your machine.
            </p>
          ) : (
            <>
              <p>
                Your API key is stored locally in this extension and is used only to
                communicate with the AI provider you selected. Your code and problem
                context are sent to that provider when you ask the tutor for help.
              </p>
              <p>
                Tufnut does not operate a server, does not store your key remotely,
                and does not track your activity.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
