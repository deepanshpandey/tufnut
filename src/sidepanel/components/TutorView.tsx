// ─────────────────────────────────────────────────────────────────────────────
// TutorView — the main conversation screen.
//
// Design decisions:
//   - Problem metadata is extracted on mount (async polling for TUF).
//   - Live code is fetched fresh just before each AI call (REQUEST_CODE).
//   - An "Override" panel lets the user manually set question text + code.
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

interface Props {
  settings:       ExtensionSettings;
  onOpenSettings: () => void;
  onOpenLogs:     () => void;
  onLog: (level: import("@/types").LogLevel, tag: string, message: string, detail?: string) => void;
}

// ── Chrome message helpers ────────────────────────────────────────────────────

async function requestProblemExtraction(): Promise<ProblemContext | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "EXTRACT_PROBLEM" },
      (response: { type: string; payload?: unknown } | undefined) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(
          response?.type === "PROBLEM_EXTRACTED"
            ? (response.payload as ProblemContext)
            : null
        );
      }
    );
  });
}

async function requestLiveCode(): Promise<{ code?: string; language?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "REQUEST_CODE" },
      (response: { type: string; payload?: unknown } | undefined) => {
        if (chrome.runtime.lastError) { resolve({}); return; }
        resolve(
          response?.type === "CODE_RESULT"
            ? (response.payload as { code?: string; language?: string })
            : {}
        );
      }
    );
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TutorView({ settings, onOpenSettings, onOpenLogs, onLog }: Props): React.JSX.Element {
  const [state, setState] = useState<ConversationState>({
    problemContext: null,
    messages:       [],
    hintLevel:      0,
    userApproach:   "",
    sessionId:      crypto.randomUUID(),
  });

  const [input,         setInput]         = useState("");
  const [approach,      setApproach]      = useState("");
  const [isLoading,     setIsLoading]     = useState(false);
  const [isExtracting,  setIsExtracting]  = useState(false);
  const [extractError,  setExtractError]  = useState<string | null>(null);

  // ── Override panel state ──────────────────────────────────────────────────
  const [showOverride,    setShowOverride]    = useState(false);
  const [overrideTitle,   setOverrideTitle]   = useState("");
  const [overrideQuestion,setOverrideQuestion]= useState("");
  const [overrideCode,    setOverrideCode]    = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Auto-extract problem metadata on mount ────────────────────────────────
  // Code is NOT fetched here — it's fetched fresh on each AI call.

  useEffect(() => {
    setIsExtracting(true);
    onLog("info", "Extractor", "Attempting problem extraction…");
    requestProblemExtraction()
      .then((ctx) => {
        if (ctx) {
          setState((prev) => ({ ...prev, problemContext: ctx }));
          onLog(
            "success",
            "Extractor",
            `Extracted "${ctx.title ?? "untitled"}" via ${ctx.extractedBy ?? "unknown"} extractor`,
            [
              ctx.statement ? `Statement: ${ctx.statement}` : null,
              ctx.language  ? `Language: ${ctx.language}` : null,
              ctx.code      ? `Code detected on mount` : "Code: will fetch on AI call",
            ].filter(Boolean).join("\n"),
          );
        } else {
          setExtractError("Couldn't detect a problem on this page.");
          onLog("warn", "Extractor", "No problem detected on this page");
        }
      })
      .catch((err) => {
        setExtractError("Extraction failed.");
        onLog("error", "Extractor", "Extraction threw an error", String(err));
      })
      .finally(() => setIsExtracting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scroll to bottom when messages update ─────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // ── Re-detect ─────────────────────────────────────────────────────────────

  const handleReExtract = useCallback(() => {
    setIsExtracting(true);
    setExtractError(null);
    onLog("info", "Extractor", "Re-extracting problem…");
    requestProblemExtraction()
      .then((ctx) => {
        if (ctx) {
          setState((prev) => ({ ...prev, problemContext: ctx }));
          onLog("success", "Extractor",
            `Re-extracted "${ctx.title ?? "untitled"}" via ${ctx.extractedBy ?? "unknown"}`);
        } else {
          setExtractError("Still couldn't detect a problem.");
          onLog("warn", "Extractor", "Re-extraction: no problem found");
        }
      })
      .catch((err) => {
        setExtractError("Extraction failed.");
        onLog("error", "Extractor", `Re-extraction error: ${String(err)}`);
      })
      .finally(() => setIsExtracting(false));
  }, [onLog]);

  // ── Apply override ────────────────────────────────────────────────────────

  const handleApplyOverride = useCallback(() => {
    if (!overrideTitle.trim() && !overrideQuestion.trim() && !overrideCode.trim()) return;
    setState((prev) => ({
      ...prev,
      problemContext: {
        ...(prev.problemContext ?? { url: window.location.href }),
        title:     overrideTitle.trim()    || prev.problemContext?.title,
        statement: overrideQuestion.trim() || prev.problemContext?.statement,
        code:      overrideCode.trim()     || prev.problemContext?.code,
        extractedBy: "manual",
      },
    }));
    onLog("info", "Override", "Problem context overridden manually");
    setShowOverride(false);
  }, [overrideTitle, overrideQuestion, overrideCode, onLog]);

  // ── Send a message to the tutor ───────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, hintOverride?: HintLevel) => {
      if (!content.trim() || isLoading) return;

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
        const currentSettings = await loadSettings();
        const config = {
          provider:  currentSettings.aiProvider,
          apiKey:    currentSettings.apiKey,
          model:     currentSettings.model,
          ollamaUrl: currentSettings.ollamaUrl,
        };

        onLog("info", "AI",
          `Sending to ${config.provider}${config.model ? ` / ${config.model}` : ""}`,
          `Hint level: ${hintOverride ?? state.hintLevel}`);

        // Fetch the latest live code from the editor right now
        const liveCode = await requestLiveCode();
        if (liveCode.code) {
          onLog("info", "Code", "Fetched live code snapshot",
            `${liveCode.code.slice(0, 80)}…`);
        }

        // Build effective problem context:
        // manual override > live code fetch > previously extracted code
        const base = state.problemContext ?? { url: window.location.href };
        const problemContext: ProblemContext = {
          ...base,
          code:     liveCode.code     || base.code,
          language: liveCode.language || base.language,
        };

        const effectiveState: ConversationState = {
          ...state,
          problemContext,
          hintLevel:    hintOverride ?? state.hintLevel,
          userApproach: approach || state.userApproach,
          messages:     [...state.messages, userMsg],
        };

        const result = await askTutor({
          state:       effectiveState,
          userMessage: content,
          config,
        });

        if (result.error) {
          onLog("error", "AI", `Provider error: ${result.error}`);
        } else {
          onLog("success", "AI", `Response received (${result.message.length} chars)`,
            result.wasSpoiler ? "Spoiler guard triggered — regenerated" : undefined);
          if (result.wasSpoiler) {
            onLog("warn", "SpoilerGuard", "Response contained a potential solution — regenerated");
          }
        }

        const assistantMsg: ChatMessage = {
          role:      "assistant",
          content:   result.error ? `⚠️ ${result.error}` : result.message,
          timestamp: Date.now(),
        };

        setState((prev) => ({ ...prev, messages: [...prev.messages, assistantMsg] }));

        // Update stored code in context so subsequent calls see it
        if (liveCode.code) {
          setState((prev) => ({
            ...prev,
            problemContext: prev.problemContext
              ? { ...prev.problemContext, code: liveCode.code, language: liveCode.language || prev.problemContext.language }
              : prev.problemContext,
          }));
        }
      } catch (err) {
        onLog("error", "AI", `Unexpected error: ${String(err)}`);
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, {
            role:      "assistant",
            content:   `⚠️ Unexpected error: ${String(err)}`,
            timestamp: Date.now(),
          }],
        }));
      } finally {
        setIsLoading(false);
      }
    },
    [state, isLoading, approach, onLog]
  );

  const handleSmallHint    = () => sendMessage("Can you give me a small hint?");
  const handleStrongerHint = () => {
    const newLevel = increaseHintLevel(state.hintLevel);
    setState((prev) => ({ ...prev, hintLevel: newLevel }));
    sendMessage("Can you give me a stronger hint?", newLevel);
  };
  const handleWhereAmIWrong = () => sendMessage("Where am I going wrong in my current approach?");

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tv">

      {/* ── Chrome-style header ── */}
      <div className="tv__header">
        <span className="tv__brand">Tufnut</span>
        <div className="tv__header-actions">
          <button className="tv__icon-btn" onClick={onOpenLogs}     title="Logs"     aria-label="Open logs">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h12v1H2zm0 3h12v1H2zm0 3h8v1H2zm0 3h8v1H2z"/>
            </svg>
          </button>
          <button className="tv__icon-btn" onClick={() => setShowOverride(v => !v)} title="Override context" aria-label="Override question or code">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81 3.427 11.133a.25.25 0 00-.065.108l-.568 1.985 1.984-.568a.25.25 0 00.108-.065L11.19 6.25z"/>
            </svg>
          </button>
          <button className="tv__icon-btn" onClick={onOpenSettings} title="Settings" aria-label="Open settings">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303a.145.145 0 01.159.06 6.5 6.5 0 01.57 1.147c.049.12.016.195-.038.248l-.811.752c-.407.378-.632.925-.632 1.57s.225 1.192.632 1.571l.811.752c.054.053.087.128.038.248a6.503 6.503 0 01-.57 1.147.145.145 0 01-.159.06l-1.102-.303c-.56-.153-1.113-.008-1.53.27-.16.107-.327.204-.501.29-.447.222-.85.629-.997 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.582 6.582 0 01-1.142 0c-.036-.003-.108-.036-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 01-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303a.145.145 0 01-.159-.06 6.5 6.5 0 01-.57-1.147c-.049-.12-.016-.195.038-.248l.811-.752c.407-.379.632-.926.632-1.571 0-.644-.225-1.192-.632-1.57l-.811-.752c-.054-.053-.087-.128-.038-.248a6.504 6.504 0 01.57-1.147.145.145 0 01.159-.06l1.102.303c.56.153 1.113.008 1.53-.27.16-.107.327-.204.501-.29.447-.222.85-.629.997-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Problem bar ── */}
      <ProblemHeader
        context={state.problemContext}
        isExtracting={isExtracting}
        extractError={extractError}
        onReExtract={handleReExtract}
      />

      {/* ── Override panel ── */}
      {showOverride && (
        <div className="tv__override">
          <p className="tv__override-label">Override problem context</p>
          <input
            className="tv__override-input"
            placeholder="Problem title (optional)"
            value={overrideTitle}
            onChange={(e) => setOverrideTitle(e.target.value)}
          />
          <textarea
            className="tv__override-textarea"
            placeholder="Problem statement / question (optional)"
            value={overrideQuestion}
            onChange={(e) => setOverrideQuestion(e.target.value)}
            rows={4}
            spellCheck={false}
          />
          <textarea
            className="tv__override-textarea tv__override-textarea--code"
            placeholder="Your current code (optional — leave blank to use live editor)"
            value={overrideCode}
            onChange={(e) => setOverrideCode(e.target.value)}
            rows={5}
            spellCheck={false}
          />
          <div className="tv__override-actions">
            <button className="tv__btn tv__btn--primary" onClick={handleApplyOverride}>
              Apply
            </button>
            <button className="tv__btn tv__btn--ghost" onClick={() => setShowOverride(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="tv__messages" role="log" aria-live="polite">
        {state.messages.length === 0 && (
          <div className="tv__empty">
            <p>Ask the tutor anything, or describe your approach and click <strong>Ask Tutor</strong>.</p>
          </div>
        )}
        {state.messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        {isLoading && (
          <div className="tv__thinking" aria-label="Tutor is thinking">
            Tutor is thinking<span className="tv__dots"><span/><span/><span/></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom toolbar ── */}
      <div className="tv__toolbar">

        {/* Hint level pill */}
        <div className="tv__hint-level">
          <span className="tv__hint-level-label">Hint</span>
          <span className="tv__hint-level-val">{state.hintLevel}</span>
        </div>

        {/* Approach input */}
        <textarea
          className="tv__approach"
          placeholder="What are you thinking? (optional)"
          value={approach}
          onChange={(e) => setApproach(e.target.value)}
          rows={2}
          aria-label="Your current approach or thinking"
        />

        {/* Main input + send */}
        <div className="tv__input-row">
          <textarea
            className="tv__input"
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
            className="tv__btn tv__btn--primary tv__send-btn"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
          >
            Ask Tutor
          </button>
        </div>

        {/* Hint action buttons */}
        <div className="tv__hint-btns">
          <button className="tv__btn tv__btn--ghost"    onClick={handleSmallHint}     disabled={isLoading}>Small Hint</button>
          <button className="tv__btn tv__btn--outline"  onClick={handleStrongerHint}  disabled={isLoading}>Stronger Hint</button>
          <button className="tv__btn tv__btn--warn"     onClick={handleWhereAmIWrong} disabled={isLoading}>Where Am I Going Wrong?</button>
        </div>

      </div>
    </div>
  );
}
