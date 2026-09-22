// ─────────────────────────────────────────────────────────────────────────────
// Content script entry point
//
// Injected into every page.  Responsibilities:
//   1. Listen for extraction requests from the background service worker.
//   2. Run the appropriate site-specific extractor (or fall back to generic).
//   3. Return the ProblemContext to the background / side panel.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExtensionMessage, ProblemContext } from "@/types";
import { extractLeetCode }      from "./extractors/leetcode";
import { extractTakeUForward }  from "./extractors/takeuforward";
import { extractGeeksForGeeks } from "./extractors/geeksforgeeks";
import { extractCodeforces }    from "./extractors/codeforces";
import { extractGeneric }       from "./extractors/generic";

// ── Extractor pipeline ────────────────────────────────────────────────────────
// Run site-specific extractors in order; fall back to generic.

function extractProblem(): ProblemContext {
  return (
    extractLeetCode()     ??
    extractTakeUForward() ??
    extractGeeksForGeeks() ??
    extractCodeforces()   ??
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
      try {
        const context = extractProblem();
        sendResponse({ type: "PROBLEM_EXTRACTED", payload: context });
      } catch (err) {
        sendResponse({
          type:    "EXTRACTION_FAILED",
          payload: String(err),
        });
      }
      // Return true to keep the message channel open for async response
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
