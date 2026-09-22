// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble — renders a single chat message (user or assistant).
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import type { ChatMessage } from "@/types";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props): React.JSX.Element {
  const isUser = message.role === "user";
  const label  = isUser ? "You" : "Tutor";

  return (
    <div
      className={`message-bubble message-bubble--${isUser ? "user" : "assistant"}`}
      role="article"
      aria-label={`${label}: ${message.content}`}
    >
      <span className="message-bubble__label">{isUser ? "🧑 You" : "🤖 Tutor"}</span>
      <div className="message-bubble__content">
        {/* Render line-breaks but no HTML to avoid injection */}
        {message.content.split("\n").map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < message.content.split("\n").length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
