// ─────────────────────────────────────────────────────────────────────────────
// LeetCode problem extractor
//
// Tested against: leetcode.com/problems/*
// LeetCode uses React and renders problem content in a specific DOM structure.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProblemContext } from "@/types";
import { extractCode } from "../code/generic";

export function extractLeetCode(): ProblemContext | null {
  try {
    const url = window.location.href;
    if (!url.includes("leetcode.com")) return null;

    // ── Title ─────────────────────────────────────────────────────────────────
    // The problem title is in a element with data-cy="question-title" or
    // inside the first <h1> in the problem container.
    const titleEl =
      document.querySelector<HTMLElement>('[data-cy="question-title"]') ??
      document.querySelector<HTMLElement>(".text-title-large a") ??
      document.querySelector<HTMLElement>("h4[data-cy]") ??
      document.querySelector<HTMLElement>('h1');
    const title = titleEl?.innerText?.trim();

    // ── Statement, examples, constraints ─────────────────────────────────────
    // LeetCode renders the problem description in a div with class that
    // contains "content__u3I1" or in [data-track-load="description_content"].
    const descEl =
      document.querySelector<HTMLElement>('[data-track-load="description_content"]') ??
      document.querySelector<HTMLElement>(".elfjS") ??
      document.querySelector<HTMLElement>(".question-content") ??
      document.querySelector<HTMLElement>('[class*="content__"]');

    let statement: string | undefined;
    let examples: string | undefined;
    let constraints: string | undefined;

    if (descEl) {
      const fullText = descEl.innerText ?? "";

      // Split on common section headers
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

    // ── Code + language ───────────────────────────────────────────────────────
    const { code, language } = extractCode();

    // Language can also be read from the language selector on LeetCode
    const langEl = document.querySelector<HTMLElement>(
      '[id="headlessui-listbox-button-\\:rh\\:"] button, [class*="langSelect"] button'
    );
    const detectedLang = language ?? langEl?.innerText?.trim() ?? undefined;

    return {
      title:       title || undefined,
      statement:   statement || undefined,
      examples:    examples || undefined,
      constraints: constraints || undefined,
      code:        code ?? undefined,
      language:    detectedLang,
      url,
      extractedBy: "leetcode",
    };
  } catch {
    return null;
  }
}
