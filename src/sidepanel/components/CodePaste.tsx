// ─────────────────────────────────────────────────────────────────────────────
// CodePaste — lets the user manually paste their code when auto-detection fails.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";

interface Props {
  code:     string;
  onChange: (code: string) => void;
  onClose:  () => void;
}

export default function CodePaste({ code, onChange, onClose }: Props): React.JSX.Element {
  return (
    <div className="code-paste">
      <div className="code-paste__header">
        <span className="code-paste__title">Your Code</span>
        {code && (
          <button
            className="code-paste__close-btn"
            onClick={onClose}
            aria-label="Hide code paste"
          >
            ✕
          </button>
        )}
      </div>
      <textarea
        className="code-paste__textarea"
        placeholder="Paste your current code here…"
        value={code}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        spellCheck={false}
        aria-label="Paste your current code"
      />
      <p className="code-paste__hint">
        Auto-detection failed or unavailable. Paste your code so the tutor can
        reference it.
      </p>
    </div>
  );
}
