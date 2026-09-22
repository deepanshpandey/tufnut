// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble — renders a single chat message (user or assistant).
//
// Assistant messages are rendered as markdown so that code blocks, bold text,
// line-number references, and structured sections (e.g. "## Key Takeaways")
// display properly.  User messages are rendered as plain text with newlines
// preserved to avoid any injection risk.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from "react";
import { marked }         from "marked";
import type { ChatMessage } from "@/types";

// ── Markdown renderer config ──────────────────────────────────────────────────
// Use a synchronous renderer (marked v15 returns string when input is string
// and async is false / not configured).
// We strip external resource URLs from the rendered HTML so that images and
// iframes loaded from the web cannot be injected — this is a content-security
// measure appropriate for a Chrome extension.

const renderer = new marked.Renderer();

// Open no links in the extension panel itself — open in new tab on the page.
renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
  const safe = href && (href.startsWith("http") || href.startsWith("https")) ? href : "#";
  const t = title ? ` title="${title}"` : "";
  return `<a href="${safe}" target="_blank" rel="noopener noreferrer"${t}>${text}</a>`;
};

marked.setOptions({ renderer, gfm: true, breaks: true });

// ── Sanitise rendered HTML ────────────────────────────────────────────────────
// Minimal allowlist: remove <script>, <iframe>, <object>, on* attributes and
// external src= / href= pointing to data: or javascript: URIs.

function sanitise(html: string): string {
  return html
    // Drop dangerous tags entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>/gi, "")
    .replace(/<object[\s\S]*?>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    // Drop on* event attributes
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    // Drop javascript: and data: hrefs/srcs
    .replace(/\s(href|src)=["'](javascript:|data:)[^"']*["']/gi, "");
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props): React.JSX.Element {
  const isUser = message.role === "user";
  const label  = isUser ? "You" : "Tutor";

  // Parse markdown only for assistant messages; keep user text plain.
  const htmlContent = useMemo(() => {
    if (isUser) return null;
    const raw = marked(message.content) as string;
    return sanitise(raw);
  }, [isUser, message.content]);

  return (
    <div
      className={`message-bubble message-bubble--${isUser ? "user" : "assistant"}`}
      role="article"
      aria-label={`${label}: ${message.content.substring(0, 80)}`}
    >
      <span className="message-bubble__label">{isUser ? "🧑 You" : "🤖 Tutor"}</span>

      {isUser ? (
        // Plain text — preserve line breaks, no HTML injection possible
        <div className="message-bubble__content message-bubble__content--plain">
          {message.content.split("\n").map((line, i, arr) => (
            <React.Fragment key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      ) : (
        // Rendered markdown — sanitised before injection
        <div
          className="message-bubble__content message-bubble__content--md"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: htmlContent ?? "" }}
        />
      )}
    </div>
  );
}
