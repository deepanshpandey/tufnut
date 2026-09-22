// ─────────────────────────────────────────────────────────────────────────────
// Spoiler guard — detects whether an AI response gives away too much.
//
// Strategy (MVP):
//   1. Deterministic heuristic: look for code blocks, long numbered lists, and
//      known tell-tale phrases that indicate a complete solution.
//   2. If heuristic fires, the caller should discard the response and call the
//      AI again with SPOILER_REGENERATION_PROMPT injected.
//
// The heuristic is intentionally conservative — false positives (blocking an
// innocent response) are better than false negatives (leaking a solution).
// ─────────────────────────────────────────────────────────────────────────────

import type { SpoilerCheckResult } from "@/types";

// ── Heuristic thresholds ──────────────────────────────────────────────────────

/** Minimum number of lines in a code block to consider it a "full solution". */
const CODE_BLOCK_LINE_THRESHOLD = 5;

/**
 * Phrases that indicate the tutor is being directive rather than Socratic.
 * Case-insensitive match.
 */
const SOLUTION_PHRASES: string[] = [
  "here is the solution",
  "here's the solution",
  "here is the complete",
  "here's the complete",
  "here is the full",
  "here's the full",
  "the answer is",
  "the solution is",
  "you should use",
  "you need to use",
  "the algorithm is",
  "the correct approach is",
  "here is the code",
  "here's the code",
  "here is how to solve",
  "here's how to solve",
  "step 1:",
  "step 2:",
  "step 3:",
  "first, initialize",
  "then iterate",
  "finally return",
  "the implementation is",
];

/** Number of numbered list items that suggests an implementation walkthrough. */
const NUMBERED_LIST_THRESHOLD = 4;

// ── Main check function ───────────────────────────────────────────────────────

export function checkForSpoilers(response: string): SpoilerCheckResult {
  const lower = response.toLowerCase();

  // 1. Large code block
  const codeBlockMatches = response.match(/```[\s\S]*?```/g) ?? [];
  for (const block of codeBlockMatches) {
    const lineCount = block.split("\n").length;
    if (lineCount >= CODE_BLOCK_LINE_THRESHOLD) {
      return {
        hasSpoiler: true,
        reason: `Contains a code block with ${lineCount} lines (threshold: ${CODE_BLOCK_LINE_THRESHOLD})`,
      };
    }
  }

  // 2. Any inline code that looks like a multi-statement implementation
  //    (contains semicolons / braces which suggest real code lines)
  const inlineCodeMatches = response.match(/`[^`]+`/g) ?? [];
  for (const snippet of inlineCodeMatches) {
    if (snippet.includes(";") && snippet.includes("{")) {
      return {
        hasSpoiler: true,
        reason: "Contains inline code that resembles a multi-statement implementation",
      };
    }
  }

  // 3. Solution tell-tale phrases
  for (const phrase of SOLUTION_PHRASES) {
    if (lower.includes(phrase)) {
      return {
        hasSpoiler: true,
        reason: `Contains tell-tale solution phrase: "${phrase}"`,
      };
    }
  }

  // 4. Long numbered list (implementation walkthrough)
  const numberedItems = response.match(/^\s*\d+\.\s+/gm) ?? [];
  if (numberedItems.length >= NUMBERED_LIST_THRESHOLD) {
    return {
      hasSpoiler: true,
      reason: `Contains ${numberedItems.length} numbered list items (threshold: ${NUMBERED_LIST_THRESHOLD}) — looks like step-by-step instructions`,
    };
  }

  return { hasSpoiler: false };
}

// ── Max regeneration attempts ─────────────────────────────────────────────────

export const MAX_REGENERATION_ATTEMPTS = 2;
