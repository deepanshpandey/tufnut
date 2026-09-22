// ─────────────────────────────────────────────────────────────────────────────
// TakeUForward (TUF / takeuforward.org) problem extractor
//
// TUF is a Next.js app that uses CSS Modules.  Class names follow the pattern:
//   ProblemPanel-module__<hash>__<semantic>
//   code-editor-module__<hash>__<semantic>
//
// Because the hash segment is stable across deploys (it's derived from the
// file path), we match on the semantic suffix using attribute selectors:
//   [class*="ProblemPanel-module"][class*="__title"]
//
// DOM structure (as of 2025-06):
//   .scrollContainer
//     header.header
//       h1.title          ← problem title  (first child with __title)
//       div.metaRow       ← difficulty / tags
//     div.richText        ← problem statement (first occurrence)
//     section*            ← examples (each has h3.sectionTitle "Example N:")
//       div.richText
//     section             ← constraints section
//       div.constraintsBox
//
// Code editor:
//   Monaco live editor    ← preferred (window.monaco exists)
//   [data-code-preview]   ← read-only preview fallback
//   code.*previewLineCode ← one element per line in the preview
//
// Timing note:
//   TUF is a Next.js SPA.  The content script fires at document_idle but the
//   React tree may not have rendered yet.  extractTakeUForwardAsync() polls
//   for the title element for up to 8 seconds before giving up.
//
// This project is inspired by TUF's own TUFY bot.  Full respect to Striver
// and the TakeUForward team and their mission of free DSA education.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProblemContext } from "@/types";
import { extractFromMonaco, detectMonacoLanguage } from "../code/monaco";
import { extractCode }                             from "../code/generic";

// ── Selector helpers (stable across hash changes) ─────────────────────────────

/** Match any element whose class contains both module segments. */
function sel(module: string, semantic: string): string {
  return `[class*="${module}-module"][class*="__${semantic}"]`;
}

const S = {
  // Use :first-of-type equivalent via :first-child workaround — querySelector
  // returns the first match in document order, which is what we want.
  title:          sel("ProblemPanel", "title"),
  richText:       sel("ProblemPanel", "richText"),
  sectionTitle:   sel("ProblemPanel", "sectionTitle"),
  constraintsBox: sel("ProblemPanel", "constraintsBox"),
  scrollContainer:sel("ProblemPanel", "scrollContainer"),
  previewLineCode:sel("code-editor", "previewLineCode"),
};

// ── Text extraction helpers ───────────────────────────────────────────────────

/** Get innerText with textContent fallback (innerText requires layout). */
function getText(el: Element): string {
  return ((el as HTMLElement).innerText ?? el.textContent ?? "").trim();
}

/** Collect all text from a list of elements. */
function joinText(els: NodeListOf<Element> | Element[]): string {
  return Array.from(els).map(getText).join("\n").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Snapshot — reads problem metadata from the DOM ───────────────────────────
// Returns null when the ProblemPanel hasn't rendered yet (caller retries).
// Code extraction is intentionally separate — see extractCodeSnapshot().

function snapshot(): Omit<ProblemContext, "code" | "language"> | null {
  const url = window.location.href;

  // ── Title ───────────────────────────────────────────────────────────────────
  // ProblemPanel-module__*__title is the <h1> inside the problem panel header.
  const titleEl = document.querySelector(S.title);
  if (!titleEl) return null; // DOM not ready yet — caller will retry

  const title = getText(titleEl).replace(/\s+/g, " ").trim() || undefined;

  // ── Find the scroll container — all problem content lives inside it ─────────
  const container =
    document.querySelector(S.scrollContainer) ?? document.body;

  // ── Problem statement — the first richText div ──────────────────────────────
  const richTexts = container.querySelectorAll(S.richText);
  const statement = richTexts.length > 0 ? getText(richTexts[0]) : undefined;

  // ── Examples — every <section> whose sectionTitle contains "Example" ────────
  const exampleParts: string[] = [];
  container.querySelectorAll("section").forEach((section) => {
    const heading = section.querySelector(S.sectionTitle);
    if (!heading) return;
    const headingText = getText(heading);
    if (!headingText.toLowerCase().includes("example")) return;
    const body = joinText(section.querySelectorAll(S.richText));
    exampleParts.push(`${headingText}\n${body}`);
  });
  const examples = exampleParts.length > 0
    ? exampleParts.join("\n\n")
    : undefined;

  // ── Constraints ─────────────────────────────────────────────────────────────
  const constraintsEl = container.querySelector(S.constraintsBox);
  const constraints = constraintsEl ? getText(constraintsEl) : undefined;

  return { title, statement, examples, constraints, url, extractedBy: "takeuforward" };
}

// ── Code snapshot — tries every available source once ────────────────────────
// Exported so the content script can request a fresh code snapshot on-demand
// (just before AI calls) without waiting for the full extraction pipeline.

export function extractCodeSnapshot(): { code?: string; language?: string } {
  // 1. Monaco live editor — window.monaco.editor.getEditors()[0].getModel()
  //    This is the authoritative source once Monaco is fully mounted.
  const monacoCode = extractFromMonaco();
  if (monacoCode) {
    // TUF sets the language via its own picker; prefer data-code-preview over
    // the Monaco language ID (which may just be "cpp" / "plaintext" anyway).
    const langWrapper = document.querySelector("[data-code-preview]");
    const language = langWrapper?.getAttribute("data-code-preview")
      ?? detectMonacoLanguage()
      ?? undefined;
    return { code: monacoCode, language };
  }

  // 2. Read-only preview lines rendered before Monaco mounts
  const previewLines = document.querySelectorAll(S.previewLineCode);
  if (previewLines.length > 0) {
    const code = Array.from(previewLines)
      .map((el) => el.textContent ?? "")
      .join("\n");
    const langWrapper = document.querySelector("[data-code-preview]");
    const language = langWrapper?.getAttribute("data-code-preview") ?? undefined;
    return { code, language };
  }

  // 3. Generic fallback (CodeMirror / textarea / contenteditable)
  const extracted = extractCode();
  if (extracted.code) {
    return { code: extracted.code, language: extracted.language ?? undefined };
  }

  return {};
}

// ── Sync entry point (used by the extractor pipeline) ────────────────────────
//
// Returns null when the URL doesn't match TUF, or when the DOM has not
// rendered yet (caller should not retry — the async path handles retries).
// Used as a belt-and-suspenders fallback; the async path is preferred.

export function extractTakeUForward(): ProblemContext | null {
  try {
    const url = window.location.href;
    if (!url.includes("takeuforward.org")) return null;
    const meta = snapshot();
    if (!meta) return null;
    const codeResult = extractCodeSnapshot();
    return { ...meta, ...codeResult };
  } catch {
    return null;
  }
}

// ── Async entry point — polls until the DOM AND editor are ready ──────────────
//
// Phase 1 — DOM: polls until ProblemPanel title element appears (up to 8 s).
// Phase 2 — Code: polls until Monaco getEditors() returns a live model,
//           OR falls back to the preview-lines / generic extractor (up to 4 s).
//
// This two-phase approach ensures we always return problem metadata even if the
// Monaco editor takes longer to mount than the problem panel.

export async function extractTakeUForwardAsync(
  maxAttempts = 16,
  intervalMs  = 500,
): Promise<ProblemContext | null> {
  const url = window.location.href;
  if (!url.includes("takeuforward.org")) return null;

  // ── Phase 1: wait for problem panel DOM ────────────────────────────────────
  let meta: Omit<ProblemContext, "code" | "language"> | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      meta = snapshot();
      if (meta !== null) break;
    } catch { /* keep retrying */ }
    await sleep(intervalMs);
  }

  if (meta === null) return null; // page never rendered — give up

  // ── Phase 2: wait for Monaco editor to mount and return a model ────────────
  // Monaco is present (window.monaco exists) but getEditors() may briefly
  // return [] while the editor component is still initialising.
  const codeMaxAttempts = 8; // up to 4 s extra
  let codeResult: { code?: string; language?: string } = {};

  for (let i = 0; i < codeMaxAttempts; i++) {
    try {
      codeResult = extractCodeSnapshot();
      if (codeResult.code) break; // got something — stop polling
    } catch { /* keep retrying */ }
    await sleep(intervalMs);
  }

  return { ...meta, ...codeResult };
}
