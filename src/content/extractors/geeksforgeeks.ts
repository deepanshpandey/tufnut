// ─────────────────────────────────────────────────────────────────────────────
// GeeksForGeeks problem extractor
//
// Tested against: geeksforgeeks.org/problems/*
// ─────────────────────────────────────────────────────────────────────────────

import type { ProblemContext } from "@/types";
import { extractCode } from "../code/generic";

export function extractGeeksForGeeks(): ProblemContext | null {
  try {
    const url = window.location.href;
    if (!url.includes("geeksforgeeks.org")) return null;

    // ── Title ─────────────────────────────────────────────────────────────────
    const titleEl =
      document.querySelector<HTMLElement>(".problems_header_content__title__L2cB2") ??
      document.querySelector<HTMLElement>('[class*="header_content__title"]') ??
      document.querySelector<HTMLElement>("h1.problem-header") ??
      document.querySelector<HTMLElement>("h3.problem-title") ??
      document.querySelector<HTMLElement>("h1");
    const title = titleEl?.innerText?.trim();

    // ── Statement ─────────────────────────────────────────────────────────────
    const statementEl =
      document.querySelector<HTMLElement>('[class*="problems_problem_content"]') ??
      document.querySelector<HTMLElement>(".problem-statement") ??
      document.querySelector<HTMLElement>('[class*="problem_content"]');

    let statement: string | undefined;
    let examples: string | undefined;
    let constraints: string | undefined;

    if (statementEl) {
      const fullText = statementEl.innerText ?? "";
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
        statement = fullText.substring(0, 3000).trim();
      }
    }

    // ── Code + language ───────────────────────────────────────────────────────
    const { code, language } = extractCode();

    // GFG has a language selector
    const langEl = document.querySelector<HTMLElement>(".g-select-header");
    const detectedLang = language ?? langEl?.innerText?.trim() ?? undefined;

    return {
      title:       title || undefined,
      statement:   statement || undefined,
      examples:    examples || undefined,
      constraints: constraints || undefined,
      code:        code ?? undefined,
      language:    detectedLang,
      url,
      extractedBy: "geeksforgeeks",
    };
  } catch {
    return null;
  }
}
