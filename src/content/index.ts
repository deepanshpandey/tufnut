// ─────────────────────────────────────────────────────────────────────────────
// Content script entry point
//
// Injected into every page.  Responsibilities:
//   1. Listen for extraction requests from the background service worker.
//   2. Run the appropriate site-specific extractor (or fall back to generic).
//   3. Return the ProblemContext to the background / side panel.
//
// SPA timing note:
//   For Next.js sites (TUF / LeetCode) the React tree renders after
//   document_idle.  The TUF extractor uses an async polling loop; other
//   extractors are synchronous and fall back gracefully when the DOM isn't
//   ready yet.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExtensionMessage, ProblemContext } from "@/types";
import { extractLeetCode }                                        from "./extractors/leetcode";
import { extractTakeUForward,
         extractTakeUForwardAsync,
         extractCodeSnapshot }                                    from "./extractors/takeuforward";
import { extractGeeksForGeeks }                                   from "./extractors/geeksforgeeks";
import { extractCodeforces }                                      from "./extractors/codeforces";
import { extractGeneric }                                         from "./extractors/generic";

// ── Extractor pipeline ────────────────────────────────────────────────────────
// Async: for TUF we poll until the DOM renders (up to ~8 s).
// For all others we try synchronously and fall back to generic.

async function extractProblem(): Promise<ProblemContext> {
  // Try TUF async first — it will immediately return null if URL doesn't match
  const tuf = await extractTakeUForwardAsync();
  if (tuf) return tuf;

  // Synchronous extractors (return null if URL doesn't match)
  return (
    extractLeetCode()      ??
    extractTakeUForward()  ??   // sync fallback (already null — belt-and-suspenders)
    extractGeeksForGeeks() ??
    extractCodeforces()    ??
    extractGeneric()
  );
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === "EXTRACT_PROBLEM") {
      extractProblem()
        .then((context) => {
          sendResponse({ type: "PROBLEM_EXTRACTED", payload: context });
        })
        .catch((err) => {
          sendResponse({ type: "EXTRACTION_FAILED", payload: String(err) });
        });
      return true;
    }

    // REQUEST_CODE — fetch only the live editor code (synchronous, no polling).
    // Called just before each AI interaction so the tutor always sees the
    // latest code without the full 8-second TUF polling wait.
    if (message.type === "REQUEST_CODE") {
      try {
        const result = extractCodeSnapshot();
        sendResponse({ type: "CODE_RESULT", payload: result });
      } catch {
        sendResponse({ type: "CODE_RESULT", payload: {} });
      }
      return true;
    }

    if (message.type === "PING") {
      sendResponse({ type: "PING", payload: "pong" });
      return true;
    }

    return false;
  }
);

// Announce content script readiness to the background worker
chrome.runtime.sendMessage({ type: "PING" }).catch(() => {
  // Ignore — the background may not have started yet on initial load
});
