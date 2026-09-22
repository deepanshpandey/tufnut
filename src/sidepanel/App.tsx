// ─────────────────────────────────────────────────────────────────────────────
// App.tsx — root component; switches between the tutor view and settings view.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import TutorView  from "./components/TutorView";
import SettingsView from "./components/SettingsView";
import type { ExtensionSettings } from "@/types";
import { loadSettings } from "@/storage/settings";

type View = "tutor" | "settings";

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>("tutor");
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    loadSettings()
      .then((s) => {
        setSettings(s);
        // If the API key is not configured, show settings first
        if (!s.apiKey) setView("settings");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
      {view === "tutor" ? (
        <TutorView
          settings={settings!}
          onOpenSettings={() => setView("settings")}
        />
      ) : (
        <SettingsView
          initialSettings={settings ?? undefined}
          onSaved={handleSettingsSaved}
          onBack={() => setView("tutor")}
        />
      )}
    </div>
  );
}
