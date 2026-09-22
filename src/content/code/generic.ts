// ─────────────────────────────────────────────────────────────────────────────
// Generic code extractor — last-resort extraction using DOM heuristics.
// Tries Monaco → CodeMirror → Textarea → ContentEditable in order.
// ─────────────────────────────────────────────────────────────────────────────

import { extractFromMonaco, detectMonacoLanguage } from "./monaco";
import { extractFromCodeMirror }                   from "./codemirror";
import { extractFromTextarea, extractFromContentEditable } from "./textarea";

export interface CodeExtractionResult {
  code:     string | null;
  language: string | null;
  method:   string;
}

/**
 * Try all known extraction strategies in order of reliability.
 * Returns the first successful result, or { code: null } if nothing works.
 */
export function extractCode(): CodeExtractionResult {
  // 1. Monaco (most specific — LeetCode, VSCode Online, etc.)
  const monacoCode = extractFromMonaco();
  if (monacoCode !== null) {
    return {
      code:     monacoCode,
      language: detectMonacoLanguage(),
      method:   "monaco",
    };
  }

  // 2. CodeMirror (Codeforces, GFG, HackerRank, etc.)
  const cmCode = extractFromCodeMirror();
  if (cmCode !== null) {
    return { code: cmCode, language: null, method: "codemirror" };
  }

  // 3. Textarea
  const taCode = extractFromTextarea();
  if (taCode !== null) {
    return { code: taCode, language: null, method: "textarea" };
  }

  // 4. ContentEditable
  const ceCode = extractFromContentEditable();
  if (ceCode !== null) {
    return { code: ceCode, language: null, method: "contenteditable" };
  }

  return { code: null, language: null, method: "none" };
}
