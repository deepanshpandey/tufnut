// ─────────────────────────────────────────────────────────────────────────────
// Textarea / contenteditable code extractor — fallbacks for simple editors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look for a <textarea> that appears to contain code.
 * Heuristic: prefer textareas with many newlines or semicolons.
 */
export function extractFromTextarea(): string | null {
  const textareas = Array.from(
    document.querySelectorAll<HTMLTextAreaElement>("textarea")
  );

  // Score each textarea: the one most likely to contain code wins
  const scored = textareas
    .map((ta) => {
      const val = ta.value;
      if (!val.trim()) return { val, score: -1 };
      const newlines   = (val.match(/\n/g)    ?? []).length;
      const semicolons = (val.match(/;/g)     ?? []).length;
      const braces     = (val.match(/[{}]/g)  ?? []).length;
      return { val, score: newlines + semicolons * 2 + braces };
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.val ?? null;
}

/**
 * Look for a contenteditable element that looks like it contains code.
 */
export function extractFromContentEditable(): string | null {
  const editables = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[contenteditable="true"], [contenteditable=""]'
    )
  );

  const scored = editables
    .map((el) => {
      // innerText requires CSS layout; fall back to textContent in non-browser envs
      const text = el.innerText ?? el.textContent ?? "";
      if (!text.trim()) return { text, score: -1 };
      const newlines   = (text.match(/\n/g)   ?? []).length;
      const semicolons = (text.match(/;/g)    ?? []).length;
      const braces     = (text.match(/[{}]/g) ?? []).length;
      return { text, score: newlines + semicolons * 2 + braces };
    })
    .filter((s) => s.score >= 3) // require some code-like structure
    .sort((a, b) => b.score - a.score);

  return scored[0]?.text ?? null;
}
