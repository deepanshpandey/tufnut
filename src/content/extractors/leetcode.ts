// ─────────────────────────────────────────────────────────────────────────────
// LeetCode problem extractor
//
// Tested against: leetcode.com/problems/*
//
// LeetCode is a React SPA. The DOM is NOT ready at document_idle — React renders
// the problem description and Monaco editor asynchronously.
//
// Strategy (mirrors TakeUForward):
//   Phase 1 — poll for the problem title + description (up to 16 × 500 ms).
//   Phase 2 — poll for the Monaco editor code snapshot (up to 8 × 500 ms).
//
// The sync wrapper `extractLeetCode()` is kept for compatibility with the
// content script dispatcher; internally it delegates to the async phase.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProblemContext } from "@/types";
import { extractFromMonaco, detectMonacoLanguage } from "../code/monaco";

// ── DOM helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollFor<T>(
  fn: () => T | null,
  attempts: number,
  intervalMs: number,
): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    const result = fn();
    if (result !== null) return result;
    await sleep(intervalMs);
  }
  return null;
}

// ── Phase 1 — problem metadata ────────────────────────────────────────────────

interface LeetCodeMeta {
  title?:       string;
  statement?:   string;
  examples?:    string;
  constraints?: string;
}

function readMeta(): LeetCodeMeta | null {
  // LeetCode renders the title in several possible locations across redesigns.
  const titleEl =
    document.querySelector<HTMLElement>('[data-cy="question-title"]') ??
    document.querySelector<HTMLElement>(".text-title-large a") ??
    document.querySelector<HTMLElement>(".text-title-large") ??
    document.querySelector<HTMLElement>("h4[data-cy]") ??
    document.querySelector<HTMLElement>("h1");

  const title = titleEl?.innerText?.trim();

  // Problem description — try known stable selectors first, then fallback.
  const descEl =
    document.querySelector<HTMLElement>('[data-track-load="description_content"]') ??
    document.querySelector<HTMLElement>(".elfjS") ??
    document.querySelector<HTMLElement>(".question-content") ??
    document.querySelector<HTMLElement>('[class*="content__"]');

  if (!descEl && !title) return null;

  let statement: string | undefined;
  let examples:  string | undefined;
  let constraints: string | undefined;

  if (descEl) {
    const fullText = descEl.innerText ?? "";

    if (!fullText.trim()) return null; // not yet rendered

    const exampleIdx    = fullText.search(/\bExample\s+\d/i);
    const constraintIdx = fullText.search(/\bConstraints:/i);

    if (exampleIdx > 0) {
      statement = fullText.substring(0, exampleIdx).trim();
      if (constraintIdx > exampleIdx) {
        examples    = fullText.substring(exampleIdx, constraintIdx).trim();
        constraints = fullText.substring(constraintIdx).trim();
      } else {
        examples = fullText.substring(exampleIdx).trim();
      }
    } else {
      statement = fullText.trim();
    }
  }

  return { title, statement, examples, constraints };
}

// ── Phase 2 — code snapshot (live; called fresh on each AI request) ───────────

export function extractCodeSnapshot(): { code?: string; language?: string } {
  // Try Monaco first (LeetCode uses Monaco)
  const monacoCode = extractFromMonaco();
  if (monacoCode) {
    return { code: monacoCode, language: detectMonacoLanguage() ?? detectLangFromUI() };
  }

  // Fallback: language selector text + any visible editor textarea
  const textarea = document.querySelector<HTMLTextAreaElement>(".monaco-editor textarea");
  if (textarea?.value) {
    return { code: textarea.value, language: detectLangFromUI() };
  }

  return {};
}

// ── Language from the LeetCode UI language picker ─────────────────────────────

function detectLangFromUI(): string | undefined {
  // Various LeetCode selectors for the language dropdown button
  const selectors = [
    '[id^="headlessui-listbox-button"] button',
    '[class*="langSelect"] button',
    '[class*="lang-select"] button',
    'button[class*="language"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    const text = el?.innerText?.trim();
    if (text && text.length < 30) return text;
  }
  return undefined;
}

// ── Full async extraction ─────────────────────────────────────────────────────

export async function extractLeetCodeAsync(): Promise<ProblemContext | null> {
  const url = window.location.href;
  if (!url.includes("leetcode.com")) return null;

  // Phase 1: wait for the problem title + description
  const meta = await pollFor(readMeta, 16, 500);
  if (!meta) {
    // Return a minimal context so the user can at least see the URL
    return { url, extractedBy: "leetcode" };
  }

  // Phase 2: wait for the code editor
  let codeSnap: { code?: string; language?: string } = {};
  for (let i = 0; i < 8; i++) {
    codeSnap = extractCodeSnapshot();
    if (codeSnap.code) break;
    await sleep(500);
  }

  return {
    title:       meta.title,
    statement:   meta.statement,
    examples:    meta.examples,
    constraints: meta.constraints,
    code:        codeSnap.code,
    language:    codeSnap.language,
    url,
    extractedBy: "leetcode",
  };
}

// ── Sync wrapper (kept for content/index.ts dispatcher) ───────────────────────
// Returns null immediately — the async version is called directly by the
// content script dispatcher which awaits it.

export function extractLeetCode(): ProblemContext | null {
  // This is intentionally NOT async-polled; the dispatcher calls
  // extractLeetCodeAsync() directly. This stub exists for the legacy sync path.
  try {
    const url = window.location.href;
    if (!url.includes("leetcode.com")) return null;
    const meta = readMeta();
    if (!meta) return null;
    const { code, language } = extractCodeSnapshot();
    return {
      title:       meta.title,
      statement:   meta.statement,
      examples:    meta.examples,
      constraints: meta.constraints,
      code,
      language,
      url,
      extractedBy: "leetcode",
    };
  } catch {
    return null;
  }
}
