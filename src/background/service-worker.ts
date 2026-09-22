// ─────────────────────────────────────────────────────────────────────────────
// Background service worker (Manifest V3)
//
// Responsibilities:
//   1. Open the side panel when the extension icon is clicked.
//   2. Forward EXTRACT_PROBLEM requests from the side panel to the active tab's
//      content script and relay the response back.
//   3. Ensure the content script is injected even if the tab was open before
//      the extension was installed or reloaded (via chrome.scripting).
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
    // EXTRACT_PROBLEM — ensure content script is loaded, then forward
    if (message.type === "EXTRACT_PROBLEM") {
      handleExtractProblem(sendResponse);
      return true;
    }

    // REQUEST_CODE — forward synchronously (content script must already be alive)
    if (message.type === "REQUEST_CODE") {
      getActiveTabId()
        .then((tabId) => {
          if (tabId === null) {
            sendResponse({ type: "CODE_RESULT", payload: {} });
            return;
          }
          return chrome.tabs.sendMessage(tabId, { type: "REQUEST_CODE" });
        })
        .then((response) => {
          sendResponse(response ?? { type: "CODE_RESULT", payload: {} });
        })
        .catch(() => {
          sendResponse({ type: "CODE_RESULT", payload: {} });
        });
      return true;
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

// ── Core extraction handler ────────────────────────────────────────────────────
//
// Strategy:
//   1. Get the active tab id.
//   2. Try sending a PING to the content script to see if it's alive.
//   3. If the PING fails (content script not injected — e.g. tab was open
//      before the extension was installed), programmatically inject it via
//      chrome.scripting.executeScript.
//   4. Forward the EXTRACT_PROBLEM message and relay the response.

async function handleExtractProblem(
  sendResponse: (response: unknown) => void
): Promise<void> {
  const tabId = await getActiveTabId();
  if (tabId === null) {
    sendResponse({ type: "EXTRACTION_FAILED", payload: "No active tab found." });
    return;
  }

  // ── Step 1: ensure the content script is alive ────────────────────────────
  const alive = await pingContentScript(tabId);
  if (!alive) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files:  ["content/index.js"],
      });
      // Give the freshly injected script a moment to register its listener
      await sleep(150);
    } catch (injErr) {
      sendResponse({
        type:    "EXTRACTION_FAILED",
        payload: `Could not inject content script: ${String(injErr)}`,
      });
      return;
    }
  }

  // ── Step 2: forward the extraction request ────────────────────────────────
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PROBLEM" });
    sendResponse(response ?? { type: "EXTRACTION_FAILED", payload: "No response from content script." });
  } catch (err) {
    sendResponse({
      type:    "EXTRACTION_FAILED",
      payload: `Content script error: ${String(err)}`,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

/** Returns true if the content script in tabId responds to a PING. */
async function pingContentScript(tabId: number): Promise<boolean> {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return resp?.type === "PING";
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
