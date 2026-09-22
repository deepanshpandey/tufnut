// ─────────────────────────────────────────────────────────────────────────────
// TutorView — the main conversation screen.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import type {
  ExtensionSettings,
  ProblemContext,
  ChatMessage,
  ConversationState,
  HintLevel,
} from "@/types";
import { askTutor, increaseHintLevel }  from "@/ai/tutor";
import { loadSettings }                 from "@/storage/settings";
import MessageBubble                    from "./MessageBubble";
import ProblemHeader                    from "./ProblemHeader";
import CodePaste                        from "./CodePaste";

interface Props {
  settings:      ExtensionSettings;
  onOpenSettings: () => void;
}

// ── Helper: send a message to the background service worker ──────────────────

async function requestProblemExtraction(): Promise<ProblemContext | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "EXTRACT_PROBLEM" },
      (response: { type: string; payload?: unknown } | undefined) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        if (response?.type === "PROBLEM_EXTRACTED") {
          resolve(response.payload as ProblemContext);
        } else {
          resolve(null);
        }
      }
    );
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TutorView({ settings, onOpenSettings }: Props): React.JSX.Element {
  const [state, setState] = useState<ConversationState>({
    problemContext: null,
    messages:       [],
    hintLevel:      0,
    userApproach:   "",
    sessionId:      crypto.randomUUID(),
  });

  const [input,       setInput]       = useState("");
  const [approach,    setApproach]    = useState("");
  const [isLoading,   setIsLoading]   = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showCodePaste, setShowCodePaste] = useState(false);
  const [manualCode,    setManualCode]    = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Auto-extract on mount ─────────────────────────────────────────────────

  useEffect(() => {
    setIsExtracting(true);
    requestProblemExtraction()
      .then((ctx) => {
        if (ctx) {
          setState((prev) => ({ ...prev, problemContext: ctx }));
          if (!ctx.code) {
            setShowCodePaste(true);
          }
        } else {
          setExtractError(
            "Couldn't detect a problem on this page. You can still paste your code below."
          );
          setShowCodePaste(true);
        }
      })
      .catch(() => {
        setExtractError("Extraction failed. Paste your code manually.");
        setShowCodePaste(true);
      })
      .finally(() => setIsExtracting(false));
  }, []);

  // ── Scroll to bottom when messages update ────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // ── Send a message to the tutor ──────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, hintOverride?: HintLevel) => {
      if (!content.trim() || isLoading) return;

      // Optimistically add user message to the UI
      const userMsg: ChatMessage = {
        role:      "user",
        content,
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        messages:     [...prev.messages, userMsg],
        userApproach: approach || prev.userApproach,
      }));
      setInput("");

      setIsLoading(true);

      try {
        // Reload settings in case the user updated them in another tab
        const currentSettings = await loadSettings();
        const config = {
          provider:   currentSettings.aiProvider,
          apiKey:     currentSettings.apiKey,
          model:      currentSettings.model,
          ollamaUrl:  currentSettings.ollamaUrl,
        };

        // Merge manual code into context if provided
        const problemContext = state.problemContext
          ? { ...state.problemContext, code: manualCode || state.problemContext.code }
          : null;

        const effectiveState: ConversationState = {
          ...state,
          problemContext,
          hintLevel:    hintOverride ?? state.hintLevel,
          userApproach: approach || state.userApproach,
          messages:     [...state.messages, userMsg],
        };

        const result = await askTutor({
          state:   effectiveState,
          userMessage: content,
          config,
        });

        const assistantMsg: ChatMessage = {
          role:      "assistant",
          content:   result.error
            ? `⚠️ ${result.error}`
            : result.message,
          timestamp: Date.now(),
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMsg],
        }));
      } catch (err) {
        const errMsg: ChatMessage = {
          role:      "assistant",
          content:   `⚠️ Unexpected error: ${String(err)}`,
          timestamp: Date.now(),
        };
        setState((prev) => ({ ...prev, messages: [...prev.messages, errMsg] }));
      } finally {
        setIsLoading(false);
      }
    },
    [state, isLoading, approach, manualCode]
  );

  // ── Hint buttons ─────────────────────────────────────────────────────────

  const handleSmallHint = () => {
    sendMessage("Can you give me a small hint?");
  };

  const handleStrongerHint = () => {
    const newLevel = increaseHintLevel(state.hintLevel);
    setState((prev) => ({ ...prev, hintLevel: newLevel }));
    sendMessage("Can you give me a stronger hint?", newLevel);
  };

  const handleWhereAmIWrong = () => {
    sendMessage("Where am I going wrong in my current approach?");
  };

  // ── Re-extract button ─────────────────────────────────────────────────────

  const handleReExtract = () => {
    setIsExtracting(true);
    setExtractError(null);
    requestProblemExtraction()
      .then((ctx) => {
        if (ctx) {
          setState((prev) => ({ ...prev, problemContext: ctx }));
          if (ctx.code) setShowCodePaste(false);
        } else {
          setExtractError("Still couldn't detect a problem. Paste your code below.");
        }
      })
      .catch(() => setExtractError("Extraction failed."))
      .finally(() => setIsExtracting(false));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tutor-view">
      {/* ── Header ── */}
      <div className="tutor-view__header">
        <span className="tutor-view__brand">🧠 Tufnut</span>
        <button
          className="tutor-view__settings-btn"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Open settings"
        >
          ⚙
        </button>
      </div>

      {/* ── Problem header ── */}
      <ProblemHeader
        context={state.problemContext}
        isExtracting={isExtracting}
        extractError={extractError}
        onReExtract={handleReExtract}
      />

      {/* ── Code paste panel ── */}
      {showCodePaste && (
        <CodePaste
          code={manualCode}
          onChange={setManualCode}
          onClose={() => setShowCodePaste(false)}
        />
      )}
      {!showCodePaste && (
        <button
          className="tutor-view__paste-toggle"
          onClick={() => setShowCodePaste(true)}
        >
          {manualCode ? "✏ Edit pasted code" : "📋 Paste code manually"}
        </button>
      )}

      {/* ── Messages ── */}
      <div className="tutor-view__messages" role="log" aria-live="polite">
        {state.messages.length === 0 && (
          <div className="tutor-view__empty">
            <p>
              Ask the tutor anything about the problem, or describe your approach
              below and click <strong>Ask Tutor</strong>.
            </p>
          </div>
        )}
        {state.messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        {isLoading && (
          <div className="tutor-view__thinking" aria-label="Tutor is thinking">
            <span className="dot-pulse" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Hint level indicator ── */}
      <div className="tutor-view__hint-info">
        <span>Hint Level: {state.hintLevel}</span>
      </div>

      {/* ── Approach input ── */}
      <div className="tutor-view__approach">
        <textarea
          className="tutor-view__approach-input"
          placeholder="What are you thinking? (optional)"
          value={approach}
          onChange={(e) => setApproach(e.target.value)}
          rows={2}
          aria-label="Your current approach or thinking"
        />
      </div>

      {/* ── Main input + send ── */}
      <div className="tutor-view__input-row">
        <textarea
          className="tutor-view__input"
          placeholder="Ask something…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          rows={2}
          disabled={isLoading}
          aria-label="Message to tutor"
        />
        <button
          className="tutor-view__send-btn"
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          Ask Tutor
        </button>
      </div>

      {/* ── Hint buttons ── */}
      <div className="tutor-view__hint-btns">
        <button
          className="tutor-view__hint-btn"
          onClick={handleSmallHint}
          disabled={isLoading}
          title="Get a small directional hint"
        >
          Small Hint
        </button>
        <button
          className="tutor-view__hint-btn tutor-view__hint-btn--stronger"
          onClick={handleStrongerHint}
          disabled={isLoading}
          title="Get a stronger hint (increases hint level)"
        >
          Stronger Hint
        </button>
        <button
          className="tutor-view__hint-btn tutor-view__hint-btn--debug"
          onClick={handleWhereAmIWrong}
          disabled={isLoading}
          title="Ask the tutor to identify where your approach might be wrong"
        >
          Where Am I Going Wrong?
        </button>
      </div>
    </div>
  );
}
