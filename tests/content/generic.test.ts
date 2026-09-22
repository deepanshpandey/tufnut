// ─────────────────────────────────────────────────────────────────────────────
// Tests: generic page extractor (using jsdom)
// ─────────────────────────────────────────────────────────────────────────────

import { extractGeneric } from "../../src/content/extractors/generic";

// jsdom is provided by jest-environment-jsdom

describe("extractGeneric", () => {
  beforeEach(() => {
    // Reset the DOM between tests
    document.title = "";
    document.body.innerHTML = "";
  });

  it("extracts the page title from <h1>", () => {
    document.body.innerHTML = `
      <h1>Two Sum</h1>
      <main><p>Given an array of integers, find two numbers...</p></main>
    `;
    const ctx = extractGeneric();
    expect(ctx.title).toBe("Two Sum");
  });

  it("falls back to document.title when no h1 is present", () => {
    document.title = "Binary Search — LeetCode";
    document.body.innerHTML = `<main><p>Search in a sorted array.</p></main>`;
    const ctx = extractGeneric();
    expect(ctx.title).toBe("Binary Search — LeetCode");
  });

  it("extracts statement text from <main>", () => {
    document.body.innerHTML = `
      <main><p>Given a sorted array of distinct integers and a target value.</p></main>
    `;
    const ctx = extractGeneric();
    expect(ctx.statement).toContain("sorted array");
  });

  it("splits statement from examples when 'Example' keyword is present", () => {
    document.body.innerHTML = `
      <article>
        <p>Given an array of integers.</p>
        <p>Example 1: Input: [2,7,11,15] Output: [0,1]</p>
        <p>Constraints: 1 &lt;= n &lt;= 10^4</p>
      </article>
    `;
    const ctx = extractGeneric();
    expect(ctx.statement).not.toContain("Example");
    expect(ctx.examples).toContain("Example");
    expect(ctx.constraints).toContain("Constraints");
  });

  it("always includes the page URL", () => {
    document.body.innerHTML = "<p>Some content</p>";
    const ctx = extractGeneric();
    expect(typeof ctx.url).toBe("string");
  });

  it("sets extractedBy to 'generic'", () => {
    document.body.innerHTML = "<p>Some content</p>";
    const ctx = extractGeneric();
    expect(ctx.extractedBy).toBe("generic");
  });

  it("caps statement length at 3000 characters", () => {
    const longText = "word ".repeat(1000); // 5000 chars
    document.body.innerHTML = `<main><p>${longText}</p></main>`;
    const ctx = extractGeneric();
    expect((ctx.statement ?? "").length).toBeLessThanOrEqual(3000);
  });
});
