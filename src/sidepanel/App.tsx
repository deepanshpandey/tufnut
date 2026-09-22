// ─────────────────────────────────────────────────────────────────────────────
// App.tsx — root component; switches between tutor / settings / logs views.
// Owns the shared logs state so LogsView persists across view switches.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import TutorView    from "./components/TutorView";
import SettingsView from "./components/SettingsView";
import LogsView     from "./components/LogsView";
import type { ExtensionSettings, LogEntry, LogLevel } from "@/types";
import { loadSettings } from "@/storage/settings";

type View = "tutor" | "settings" | "logs";

export default function App(): React.JSX.Element {
  const [view,     setView]     = useState<View>("tutor");
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [logs,     setLogs]     = useState<LogEntry[]>([]);

  useEffect(() => {
    loadSettings()
      .then((s) => {
        setSettings(s);
        if (!s.apiKey) setView("settings");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Logger factory — passed down to TutorView ─────────────────────────────

  const addLog = useCallback((
    level: LogLevel,
    tag: string,
    message: string,
    detail?: string,
  ) => {
    setLogs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: Date.now(), level, tag, message, detail },
    ]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const handleSettingsSaved = (updated: ExtensionSettings) => {
    setSettings(updated);
    setView("tutor");
  };

  if (loading) {
    return (
      <div className="app-loading">
        <span className="app-loading__spinner" aria-label="Loading…" />
      </div>
    );
  }

  return (
    <div className="app">
      {view === "tutor" && (
        <TutorView
          settings={settings!}
          onOpenSettings={() => setView("settings")}
          onOpenLogs={() => setView("logs")}
          onLog={addLog}
        />
      )}
      {view === "settings" && (
        <SettingsView
          initialSettings={settings ?? undefined}
          onSaved={handleSettingsSaved}
          onBack={() => setView("tutor")}
        />
      )}
      {view === "logs" && (
        <LogsView
          logs={logs}
          onBack={() => setView("tutor")}
          onClear={clearLogs}
        />
      )}
    </div>
  );
}
