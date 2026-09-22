// ─────────────────────────────────────────────────────────────────────────────
// TakeUForward (TUF / takeuforward.org) problem extractor
//
// This project is inspired by TUF's own TUFY bot.  Full respect to Striver
// and the TakeUForward team and their mission of free DSA education.
// This extension simply allows users to bring their own API key.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProblemContext } from "@/types";
import { extractCode } from "../code/generic";

export function extractTakeUForward(): ProblemContext | null {
  try {
    const url = window.location.href;
    if (!url.includes("takeuforward.org")) return null;

    // ── Title ─────────────────────────────────────────────────────────────────
    // TUF renders the problem title in an <h1> or the article heading.
    const titleEl =
      document.querySelector<HTMLElement>("article h1") ??
      document.querySelector<HTMLElement>(".problem-title h1") ??
      document.querySelector<HTMLElement>(".entry-title") ??
      document.querySelector<HTMLElement>("h1");
    const title = titleEl?.innerText?.trim();

    // ── Problem content ───────────────────────────────────────────────────────
    // TUF posts are WordPress-based; the content lives in .entry-content or
    // the article body.
    const contentEl =
      document.querySelector<HTMLElement>(".entry-content") ??
      document.querySelector<HTMLElement>("article .content") ??
      document.querySelector<HTMLElement>("article");

    let statement: string | undefined;
    let examples: string | undefined;
    let constraints: string | undefined;

    if (contentEl) {
      const fullText = contentEl.innerText ?? "";

      const exampleIdx    = fullText.search(/\bExample\s*[:\d]/i);
      const constraintIdx = fullText.search(/\bConstraints?\s*:/i);

      if (exampleIdx > 0) {
        statement = fullText.substring(0, exampleIdx).trim();
        if (constraintIdx > exampleIdx) {
          examples    = fullText.substring(exampleIdx, constraintIdx).trim();
          constraints = fullText.substring(constraintIdx).trim();
        } else {
          examples = fullText.substring(exampleIdx).trim();
        }
      } else {
        // Cap to avoid sending enormous blog posts
        statement = fullText.substring(0, 3000).trim();
      }
    }

    // ── Code ──────────────────────────────────────────────────────────────────
    const { code, language } = extractCode();

    return {
      title:       title || undefined,
      statement:   statement || undefined,
      examples:    examples || undefined,
      constraints: constraints || undefined,
      code:        code ?? undefined,
      language:    language ?? undefined,
      url,
      extractedBy: "takeuforward",
    };
  } catch {
    return null;
  }
}
