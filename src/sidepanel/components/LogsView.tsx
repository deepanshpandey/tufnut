// ─────────────────────────────────────────────────────────────────────────────
// LogsView — shows a chronological log of extraction and AI events.
//
// Receives a log[] prop from TutorView via App.tsx and renders them clearly.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useEffect } from "react";
import type { LogEntry } from "@/types";

interface Props {
  logs:   LogEntry[];
  onBack: () => void;
  onClear: () => void;
}

const LEVEL_ICON: Record<LogEntry["level"], string> = {
  info:    "ℹ",
  success: "✓",
  warn:    "⚠",
  error:   "✕",
};

export default function LogsView({ logs, onBack, onClear }: Props): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="logs-view">
      {/* ── Header ── */}
      <div className="logs-view__header">
        <button className="logs-view__back-btn" onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <h2 className="logs-view__title">Logs</h2>
        <button
          className="logs-view__clear-btn"
          onClick={onClear}
          disabled={logs.length === 0}
          title="Clear all logs"
          aria-label="Clear logs"
        >
          Clear
        </button>
      </div>

      {/* ── Log list ── */}
      <div className="logs-view__body" role="log" aria-live="polite">
        {logs.length === 0 ? (
          <p className="logs-view__empty">No events yet. Interact with the tutor to see logs here.</p>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className={`logs-view__entry logs-view__entry--${entry.level}`}
            >
              <span className="logs-view__entry-icon" aria-hidden="true">
                {LEVEL_ICON[entry.level]}
              </span>
              <div className="logs-view__entry-body">
                <span className="logs-view__entry-tag">{entry.tag}</span>
                <span className="logs-view__entry-msg">{entry.message}</span>
                {entry.detail && (
                  <pre className="logs-view__entry-detail">{entry.detail}</pre>
                )}
              </div>
              <span className="logs-view__entry-time">
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour:   "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
