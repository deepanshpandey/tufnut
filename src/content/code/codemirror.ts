// ─────────────────────────────────────────────────────────────────────────────
// CodeMirror editor code extractor
// CodeMirror is used by Codeforces, GeeksForGeeks, HackerRank, and others.
// Supports both CodeMirror 5 and CodeMirror 6.
// ─────────────────────────────────────────────────────────────────────────────

export function extractFromCodeMirror(): string | null {
  try {
    // ── CodeMirror 5 ──────────────────────────────────────────────────────────
    // CM5 attaches a `CodeMirror` property directly to the wrapper DOM element.
    const cm5Wrappers = document.querySelectorAll<HTMLElement>(".CodeMirror");
    for (const wrapper of cm5Wrappers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cm = (wrapper as any).CodeMirror;
      if (cm && typeof cm.getValue === "function") {
        const value = cm.getValue() as string;
        if (value.trim()) return value;
      }
    }

    // ── CodeMirror 6 ──────────────────────────────────────────────────────────
    // CM6 uses a different architecture; the editor view is attached to the
    // `.cm-editor` element.
    const cm6Editors = document.querySelectorAll<HTMLElement>(".cm-editor");
    for (const editor of cm6Editors) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const view = (editor as any).cmView?.view;
      if (view && view.state) {
        const text = view.state.doc.toString() as string;
        if (text.trim()) return text;
      }
    }

    return null;
  } catch {
    return null;
  }
}
