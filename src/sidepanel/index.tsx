// ─────────────────────────────────────────────────────────────────────────────
// Sidepanel entry point — mounts the React app
//
// Architecture note:
//   Chrome's side panel (chrome.sidePanel API) renders a standard HTML page —
//   it is NOT a content script.  The HTML shell (sidepanel.html) is loaded
//   directly by Chrome in its own isolated renderer, exactly like a popup.
//
//   React is the UI framework for that HTML page.  Webpack bundles everything
//   into dist/sidepanel/sidepanel.js which the HTML loads as a normal script.
//
//   Communication flow:
//     sidepanel (React) → chrome.runtime.sendMessage → background service worker
//     background service worker → chrome.tabs.sendMessage → content script
//     content script → DOM extraction → response back up the chain
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
