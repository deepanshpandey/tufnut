// ─────────────────────────────────────────────────────────────────────────────
// Background service worker (Manifest V3)
//
// Responsibilities:
//   1. Open the side panel when the extension icon is clicked.
//   2. Forward EXTRACT_PROBLEM requests from the side panel to the active tab's
//      content script and relay the response back.
//   3. Store / retrieve settings on behalf of the side panel (settings are
//      already in chrome.storage.local but the background can mediate).
// ─────────────────────────────────────────────────────────────────────────────

import type { ExtensionMessage } from "@/types";

// ── Side panel behaviour ──────────────────────────────────────────────────────

// Open the side panel when the action icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ── Message relay ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    // EXTRACT_PROBLEM — forward to the active tab's content script
    if (message.type === "EXTRACT_PROBLEM") {
      getActiveTabId()
        .then((tabId) => {
          if (tabId === null) {
            sendResponse({
              type:    "EXTRACTION_FAILED",
              payload: "No active tab found.",
            });
            return;
          }
          return chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PROBLEM" });
        })
        .then((response) => {
          sendResponse(response ?? { type: "EXTRACTION_FAILED", payload: "No response from content script." });
        })
        .catch((err) => {
          sendResponse({
            type:    "EXTRACTION_FAILED",
            payload: `Content script error: ${String(err)}`,
          });
        });

      return true; // keep channel open
    }

    // OPEN_SIDE_PANEL — explicitly open the panel (unused in MVP, reserved)
    if (message.type === "OPEN_SIDE_PANEL") {
      getActiveTabId().then((tabId) => {
        if (tabId !== null) {
          chrome.sidePanel.open({ tabId }).catch(console.error);
        }
        sendResponse({ ok: true });
      });
      return true;
    }

    // Ignore messages from the content script (like PING)
    if (sender.tab) return false;

    return false;
  }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}
