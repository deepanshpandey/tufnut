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
import { askTutor, increaseHintLevel, getCorrectCode } from "@/ai/tutor";
import { loadSettings }                                 from "@/storage/settings";
import MessageBubble                                    from "./MessageBubble";
import ProblemHeader                                    from "./ProblemHeader";

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

function makeFreshState(): ConversationState {
  return {
    problemContext: null,
    messages:       [],
    hintLevel:      0,
    userApproach:   "",
    sessionId:      crypto.randomUUID(),
  };
}

export default function TutorView({ settings, onOpenSettings, onOpenLogs, onLog }: Props): React.JSX.Element {
  const [state, setState] = useState<ConversationState>(makeFreshState);

  const [input,              setInput]              = useState("");
  const [approach,           setApproach]           = useState("");
  const [isLoading,          setIsLoading]          = useState(false);
  const [isExtracting,       setIsExtracting]       = useState(false);
  const [extractError,       setExtractError]       = useState<string | null>(null);
  const [showOverride,       setShowOverride]       = useState(false);
  const [overrideTitle,      setOverrideTitle]      = useState("");
  const [overrideQuestion,   setOverrideQuestion]   = useState("");
  const [overrideCode,       setOverrideCode]       = useState("");
  const [confirmSolution,    setConfirmSolution]    = useState(false);
  const [isSolutionLoading,  setIsSolutionLoading]  = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  // ── Auto-extract problem metadata on mount ────────────────────────────────

  useEffect(() => {
    setIsExtracting(true);
    onLog("info", "Extractor", "Attempting problem extraction…");
    requestProblemExtraction()
      .then((ctx) => {
        if (ctx) {
          setState((prev) => ({ ...prev, problemContext: ctx }));
          onLog("success", "Extractor",
            `Extracted "${ctx.title ?? "untitled"}" via ${ctx.extractedBy ?? "unknown"} extractor`,
            [
              ctx.statement ? `Statement: ${ctx.statement}` : null,
              ctx.language  ? `Language: ${ctx.language}` : null,
              "Code: will fetch on AI call",
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
        title:       overrideTitle.trim()    || prev.problemContext?.title,
        statement:   overrideQuestion.trim() || prev.problemContext?.statement,
        code:        overrideCode.trim()     || prev.problemContext?.code,
        extractedBy: "manual",
      },
    }));
    onLog("info", "Override", "Problem context overridden manually");
    setShowOverride(false);
  }, [overrideTitle, overrideQuestion, overrideCode, onLog]);

  // ── Core send ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, hintOverride?: HintLevel) => {
      if (!content.trim() || isLoading) return;

      const userMsg: ChatMessage = { role: "user", content, timestamp: Date.now() };
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

        const liveCode = await requestLiveCode();
        if (liveCode.code) onLog("info", "Code", "Fetched live code snapshot", liveCode.code);

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

        const result = await askTutor({ state: effectiveState, userMessage: content, config });

        if (result.error) {
          onLog("error", "AI", `Provider error: ${result.error}`);
        } else {
          onLog("success", "AI", `Response received (${result.message.length} chars)`,
            result.wasSpoiler ? "Spoiler guard triggered — regenerated" : undefined);
          if (result.wasSpoiler) onLog("warn", "SpoilerGuard", "Response contained a potential solution — regenerated");
        }

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, {
            role:      "assistant",
            content:   result.error ? `⚠️ ${result.error}` : result.message,
            timestamp: Date.now(),
          }],
        }));

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
            role: "assistant" as const,
            content: `⚠️ Unexpected error: ${String(err)}`,
            timestamp: Date.now(),
          }],
        }));
      } finally {
        setIsLoading(false);
      }
    },
    [state, isLoading, approach, onLog]
  );

  // ── Hint actions ──────────────────────────────────────────────────────────

  // ── Reset / new problem ───────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setState(makeFreshState());
    setInput("");
    setApproach("");
    setExtractError(null);
    setShowOverride(false);
    setConfirmSolution(false);
    onLog("info", "Session", "Conversation reset — starting fresh");
    // Re-extract immediately
    setIsExtracting(true);
    requestProblemExtraction()
      .then((ctx) => {
        if (ctx) {
          setState((prev) => ({ ...prev, problemContext: ctx }));
          onLog("success", "Extractor", `Re-extracted "${ctx.title ?? "untitled"}"`);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsExtracting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLog]);

  const handleSmallHint     = () => sendMessage("Can you give me a small hint?");
  const handleStrongerHint  = () => {
    const newLevel = increaseHintLevel(state.hintLevel);
    setState((prev) => ({ ...prev, hintLevel: newLevel }));
    sendMessage("Can you give me a stronger hint?", newLevel);
  };
  const handleWhereAmIWrong = () => sendMessage("Where am I going wrong in my current approach?");

  // ── Get correct code ──────────────────────────────────────────────────────

  const handleGetCorrectCode = useCallback(async () => {
    if (!confirmSolution) { setConfirmSolution(true); return; }
    setConfirmSolution(false);
    setIsSolutionLoading(true);
    try {
      const currentSettings = await loadSettings();
      const config = {
        provider:  currentSettings.aiProvider,
        apiKey:    currentSettings.apiKey,
        model:     currentSettings.model,
        ollamaUrl: currentSettings.ollamaUrl,
      };
      onLog("info", "Solution", "Fetching correct code + explanation…");
      const liveCode = await requestLiveCode();
      const base = state.problemContext ?? { url: window.location.href };
      const problemContext = {
        ...base,
        code:     liveCode.code     || base.code,
        language: liveCode.language || base.language,
      };
      const result = await getCorrectCode({ ...state, problemContext }, config);
      if (result.error) {
        onLog("error", "Solution", `Error: ${result.error}`);
      } else {
        onLog("success", "Solution", "Correct code + explanation received");
      }
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, {
          role:      "assistant" as const,
          content:   result.error ? `⚠️ ${result.error}` : result.message,
          timestamp: Date.now(),
        }],
      }));
    } catch (err) {
      onLog("error", "Solution", `Unexpected error: ${String(err)}`);
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, {
          role:      "assistant" as const,
          content:   `⚠️ Unexpected error: ${String(err)}`,
          timestamp: Date.now(),
        }],
      }));
    } finally {
      setIsSolutionLoading(false);
    }
  }, [confirmSolution, state, onLog]);

  const busy = isLoading || isSolutionLoading;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tv">

      {/* ── Header ── */}
      <div className="tv__header">
        <span className="tv__brand">Tufnut</span>
        <div className="tv__header-actions">
          <button className="tv__icon-btn" onClick={handleReset} title="New problem / reset conversation" aria-label="Reset conversation" disabled={busy}>
            {/* Refresh / reset icon */}
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
          </button>
          <button className="tv__icon-btn" onClick={onOpenLogs} title="Logs" aria-label="Open logs">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h12v1H2zm0 3h12v1H2zm0 3h8v1H2zm0 3h8v1H2z"/>
            </svg>
          </button>
          <button className="tv__icon-btn" onClick={() => setShowOverride(v => !v)} title="Override context" aria-label="Override question or code">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81 3.427 11.133a.25.25 0 00-.065.108l-.568 1.985 1.984-.568a.25.25 0 00.108-.065L11.19 6.25z"/>
            </svg>
          </button>
          <button className="tv__icon-btn" onClick={onOpenSettings} title="Settings" aria-label="Open settings">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
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
          <p className="tv__override-label">Override context</p>
          <input
            className="tv__override-input"
            placeholder="Problem title (optional)"
            value={overrideTitle}
            onChange={(e) => setOverrideTitle(e.target.value)}
          />
          <textarea
            className="tv__override-textarea"
            placeholder="Problem statement (optional)"
            value={overrideQuestion}
            onChange={(e) => setOverrideQuestion(e.target.value)}
            rows={3}
            spellCheck={false}
          />
          <textarea
            className="tv__override-textarea tv__override-textarea--code"
            placeholder="Your code — leave blank to use live editor"
            value={overrideCode}
            onChange={(e) => setOverrideCode(e.target.value)}
            rows={4}
            spellCheck={false}
          />
          <div className="tv__override-actions">
            <button className="tv__btn tv__btn--primary" onClick={handleApplyOverride}>Apply</button>
            <button className="tv__btn tv__btn--ghost"   onClick={() => setShowOverride(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="tv__messages" role="log" aria-live="polite">
        {state.messages.length === 0 && (
          <div className="tv__empty">
            <svg className="tv__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"/>
            </svg>
            <p>Ask anything about the problem,<br/>or use a quick action below.</p>
          </div>
        )}
        {state.messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        {busy && (
          <div className="tv__thinking" aria-label="Tufnut is thinking">
            <span className="tv__thinking-dots"><span/><span/><span/></span>
            <span>Tufnut is thinking</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Compose footer ── */}
      <div className="tv__footer">

        {/* Approach + input stacked, send button on the right */}
        <div className="tv__compose">
          <div className="tv__compose-fields">
            <textarea
              className="tv__approach-input"
              placeholder="Your approach (optional)…"
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              rows={1}
              aria-label="Your current approach or thinking"
            />
            <div className="tv__compose-divider" />
            <textarea
              ref={inputRef}
              className="tv__message-input"
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
              disabled={busy}
              aria-label="Message to tutor"
            />
          </div>
          <button
            className="tv__send-btn"
            onClick={() => sendMessage(input)}
            disabled={busy || !input.trim()}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.724 1.053a.5.5 0 0 0-.714.545l1.403 4.85a.5.5 0 0 0 .397.354l5.69.953c.268.053.268.437 0 .49l-5.69.953a.5.5 0 0 0-.397.354l-1.403 4.85a.5.5 0 0 0 .714.545l13-6.5a.5.5 0 0 0 0-.894l-13-6.5z"/>
            </svg>
          </button>
        </div>

        {/* Action row */}
        <div className="tv__actions">

          {/* Hint level chip */}
          <div className="tv__hint-chip" title={`Current hint level: ${state.hintLevel}`}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-.25A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 110-2 1 1 0 010 2z"/>
            </svg>
            <span>{state.hintLevel}</span>
          </div>

          {/* Hint buttons */}
          <button className="tv__action-btn"                onClick={handleSmallHint}    disabled={busy}>Small Hint</button>
          <button className="tv__action-btn tv__action-btn--accent" onClick={handleStrongerHint} disabled={busy}>Stronger Hint</button>
          <button className="tv__action-btn tv__action-btn--warn"   onClick={handleWhereAmIWrong} disabled={busy}>Where Am I Going Wrong?</button>

          {/* Divider */}
          <div className="tv__actions-sep" />

          {/* Solution button */}
          {confirmSolution ? (
            <>
              <span className="tv__confirm-text">Reveal full solution?</span>
              <button className="tv__action-btn tv__action-btn--solution" onClick={handleGetCorrectCode} disabled={busy}>
                {isSolutionLoading ? "…" : "Yes"}
              </button>
              <button className="tv__action-btn" onClick={() => setConfirmSolution(false)} disabled={busy}>No</button>
            </>
          ) : (
            <button
              className="tv__action-btn tv__action-btn--solution"
              onClick={handleGetCorrectCode}
              disabled={busy}
              title="Reveal correct solution with full explanation"
            >
              Get Correct Code
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
