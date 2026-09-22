// ─────────────────────────────────────────────────────────────────────────────
// Codeforces problem extractor
//
// Tested against: codeforces.com/problemset/problem/*  and
//                 codeforces.com/contest/*/problem/*
// ─────────────────────────────────────────────────────────────────────────────

import type { ProblemContext } from "@/types";
import { extractCode } from "../code/generic";

export function extractCodeforces(): ProblemContext | null {
  try {
    const url = window.location.href;
    if (!url.includes("codeforces.com")) return null;

    // ── Title ─────────────────────────────────────────────────────────────────
    const titleEl = document.querySelector<HTMLElement>(
      ".problem-statement .header .title"
    );
    const title = titleEl?.innerText?.trim();

    // ── Statement sections ────────────────────────────────────────────────────
    const problemStatement = document.querySelector<HTMLElement>(
      ".problem-statement"
    );

    let statement: string | undefined;
    let examples: string | undefined;
    let constraints: string | undefined;

    if (problemStatement) {
      // Codeforces uses well-structured divs
      const sections = problemStatement.querySelectorAll<HTMLElement>(
        ".section-title"
      );

      const stmtDiv = problemStatement.querySelector<HTMLElement>(
        ".problem-statement > div:nth-child(2)"
      );
      if (stmtDiv) statement = stmtDiv.innerText?.trim();

      // Find the "Examples" section
      for (const section of sections) {
        const heading = section.innerText?.toLowerCase() ?? "";
        if (heading.includes("example")) {
          examples = section.parentElement?.innerText?.trim();
        }
      }

      // Time + memory limits as constraints
      const limitEl = problemStatement.querySelector<HTMLElement>(".header");
      if (limitEl) {
        constraints = limitEl.innerText?.trim();
      }
    }

    // ── Code + language ───────────────────────────────────────────────────────
    const { code, language } = extractCode();

    // Codeforces shows the selected language in a <select>
    const langSelect = document.querySelector<HTMLSelectElement>(
      "select[name='programTypeId'], #programTypeId"
    );
    const selectedLang =
      langSelect?.options[langSelect.selectedIndex]?.text?.trim() ?? undefined;
    const detectedLang = language ?? selectedLang;

    return {
      title:       title || undefined,
      statement:   statement || undefined,
      examples:    examples || undefined,
      constraints: constraints || undefined,
      code:        code ?? undefined,
      language:    detectedLang,
      url,
      extractedBy: "codeforces",
    };
  } catch {
    return null;
  }
}
