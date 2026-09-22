// ─────────────────────────────────────────────────────────────────────────────
// Generic page extractor — used as a fallback for unknown/unsupported sites.
//
// Strategy:
//   1. Try to get the page title from <title> / <h1>.
//   2. Look for common semantic HTML elements that might contain a problem.
//   3. Grab the first 3000 characters of meaningful visible body text.
//   4. Attempt code extraction.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProblemContext } from "@/types";
import { extractCode } from "../code/generic";

/** Tags whose text we always skip — navigation, footers, scripts, etc. */
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "HEADER", "NAV", "FOOTER",
  "ASIDE", "BUTTON", "INPUT", "SELECT", "TEXTAREA",
]);

/** Maximum characters of statement text to include (avoid sending entire page). */
const MAX_STATEMENT_CHARS = 3000;

// ── Visible text extractor ────────────────────────────────────────────────────

function getVisibleText(root: HTMLElement): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      const style = window.getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const parts: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text) parts.push(text);
  }
  return parts.join(" ");
}

// ── Main generic extractor ────────────────────────────────────────────────────

export function extractGeneric(): ProblemContext {
  const url = window.location.href;

  // ── Title ──────────────────────────────────────────────────────────────────
  const h1 = document.querySelector<HTMLElement>("h1");
  // Use textContent as a fallback — innerText requires CSS layout (unavailable in tests/workers)
  const title =
    (h1?.innerText ?? h1?.textContent)?.trim() ||
    document.title.trim() ||
    undefined;

  // ── Look for <article>, <main>, or .content containers ────────────────────
  const contentEl =
    document.querySelector<HTMLElement>("article") ??
    document.querySelector<HTMLElement>("main") ??
    document.querySelector<HTMLElement>('[role="main"]') ??
    document.querySelector<HTMLElement>(".problem") ??
    document.querySelector<HTMLElement>(".content") ??
    document.body;

  const rawText = getVisibleText(contentEl as HTMLElement);

  // Split into statement / examples / constraints if the keywords are present
  let statement: string | undefined;
  let examples: string | undefined;
  let constraints: string | undefined;

  const exampleIdx    = rawText.search(/\bExample\s*[:\d]/i);
  const constraintIdx = rawText.search(/\bConstraints?\s*:/i);

  if (exampleIdx > 0) {
    statement = rawText.substring(0, exampleIdx).trim().substring(0, MAX_STATEMENT_CHARS);
    if (constraintIdx > exampleIdx) {
      examples    = rawText.substring(exampleIdx, constraintIdx).trim();
      constraints = rawText.substring(constraintIdx).trim();
    } else {
      examples = rawText.substring(exampleIdx).trim();
    }
  } else {
    statement = rawText.substring(0, MAX_STATEMENT_CHARS).trim();
  }

  // ── Code ───────────────────────────────────────────────────────────────────
  const { code, language } = extractCode();

  return {
    title:       title,
    statement:   statement || undefined,
    examples:    examples || undefined,
    constraints: constraints || undefined,
    code:        code ?? undefined,
    language:    language ?? undefined,
    url,
    extractedBy: "generic",
  };
}
