// ─────────────────────────────────────────────────────────────────────────────
// ProblemHeader — shows the extracted problem title + extraction status.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import type { ProblemContext } from "@/types";

interface Props {
  context:        ProblemContext | null;
  isExtracting:   boolean;
  extractError:   string | null;
  onReExtract:    () => void;
}

export default function ProblemHeader({
  context,
  isExtracting,
  extractError,
  onReExtract,
}: Props): React.JSX.Element {
  if (isExtracting) {
    return (
      <div className="problem-header problem-header--loading">
        <span className="problem-header__spinner" aria-label="Extracting problem…" />
        <span>Detecting problem…</span>
      </div>
    );
  }

  if (extractError && !context) {
    return (
      <div className="problem-header problem-header--error">
        <span className="problem-header__error-text">{extractError}</span>
        <button className="problem-header__retry-btn" onClick={onReExtract}>
          Retry
        </button>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="problem-header problem-header--none">
        <span>No problem detected</span>
        <button className="problem-header__retry-btn" onClick={onReExtract}>
          Detect Problem
        </button>
      </div>
    );
  }

  return (
    <div className="problem-header">
      <div className="problem-header__row">
        <span className="problem-header__label">Problem:</span>
        <span className="problem-header__title">
          {context.title ?? "Unknown Problem"}
        </span>
        {context.extractedBy && (
          <span className="problem-header__source" title={`Extracted by ${context.extractedBy} extractor`}>
            ({context.extractedBy})
          </span>
        )}
      </div>
      {extractError && (
        <p className="problem-header__warn">{extractError}</p>
      )}
      <button
        className="problem-header__retry-btn problem-header__retry-btn--small"
        onClick={onReExtract}
        title="Re-detect the problem from the page"
      >
        ↺ Re-detect
      </button>
    </div>
  );
}
