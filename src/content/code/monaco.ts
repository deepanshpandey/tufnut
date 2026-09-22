// ─────────────────────────────────────────────────────────────────────────────
// Monaco editor code extractor
// Monaco is used by LeetCode, VSCode Online, and many other coding platforms.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to read the current code from a Monaco editor instance.
 * Returns null if no Monaco editor is found on the page.
 */
export function extractFromMonaco(): string | null {
  try {
    // Monaco exposes a global `monaco` object on many sites
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monacoGlobal = (window as any).monaco;
    if (monacoGlobal && monacoGlobal.editor) {
      const editors = monacoGlobal.editor.getEditors();
      if (editors && editors.length > 0) {
        const model = editors[0].getModel();
        if (model) {
          return model.getValue() ?? null;
        }
      }
    }

    // Some sites expose the editor on a specific DOM element via a property
    const monacoContainers = document.querySelectorAll<HTMLElement>(
      ".monaco-editor"
    );
    for (const container of monacoContainers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editorInstance = (container as any)._codeEditor;
      if (editorInstance) {
        const value = editorInstance.getValue?.();
        if (typeof value === "string" && value.trim()) return value;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Attempt to detect the language selected in a Monaco editor.
 * Returns null if not detectable.
 */
export function detectMonacoLanguage(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monacoGlobal = (window as any).monaco;
    if (monacoGlobal && monacoGlobal.editor) {
      const editors = monacoGlobal.editor.getEditors();
      if (editors && editors.length > 0) {
        const model = editors[0].getModel();
        if (model) {
          return model.getLanguageId?.() ?? null;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
