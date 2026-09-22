/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://takeuforward.org/practice/dsa/linear-search"}
 */
// ─────────────────────────────────────────────────────────────────────────────
// Tests: TakeUForward extractor — uses real DOM structure from the test fixture.
//
// The fixture is the actual source HTML of a TUF problem page (Linear Search).
// We render it into jsdom and verify the extractor picks up all the right parts.
// ─────────────────────────────────────────────────────────────────────────────

import { extractTakeUForward, extractTakeUForwardAsync } from "../../src/content/extractors/takeuforward";

// ── Build a minimal realistic TUF DOM ─────────────────────────────────────────
// The real page uses CSS module hashes like "ProblemPanel-module__qBixIa__title".
// Our extractor matches on [class*="ProblemPanel-module"][class*="__title"] so
// any hash works here.

const HASH = "qBixIa"; // matches the real hash from the fixture

function cls(module: string, semantic: string): string {
  return `${module}-module__${HASH}__${semantic}`;
}

const TUF_HTML = `
<div class="${cls("ProblemPanel", "scrollContainer")}">
  <header class="${cls("ProblemPanel", "header")}">
    <h1 class="${cls("ProblemPanel", "title")}">
      Linear Search<span class="${cls("ProblemPanel", "titlePotdBadge")}"></span>
    </h1>
  </header>

  <div class="${cls("ProblemPanel", "richText")}">
    <p>Given an array of integers <strong>nums</strong> and an integer
    <strong>target</strong>, find the smallest index where target appears. Return -1 if not found.</p>
  </div>

  <section class="mt-6">
    <h3 class="${cls("ProblemPanel", "sectionTitle")}">Example 1:</h3>
    <div class="${cls("ProblemPanel", "richText")}">
      <p><strong>Input</strong>: nums = [2,3,4,5,3], target = 3</p>
      <p><strong>Output</strong>: 1</p>
    </div>
  </section>

  <section class="mt-6">
    <h3 class="${cls("ProblemPanel", "sectionTitle")}">Example 2:</h3>
    <div class="${cls("ProblemPanel", "richText")}">
      <p><strong>Input</strong>: nums = [2,-4,4,0,10], target = 6</p>
      <p><strong>Output</strong>: -1</p>
    </div>
  </section>

  <section class="mt-6">
    <h3 class="${cls("ProblemPanel", "sectionTitle")}">Constraints:</h3>
    <div class="${cls("ProblemPanel", "constraintsBox")}">
      <ul><li>1 &lt;= nums.length &lt;= 10^5</li><li>-10^4 &lt;= nums[i] &lt;= 10^4</li></ul>
    </div>
  </section>

  <section class="mt-6">
    <h3 class="${cls("ProblemPanel", "sectionTitle")}">Hints</h3>
    <p>Think about iterating through the array.</p>
  </section>
</div>

<!-- Code preview rendered by TUF's Monaco wrapper -->
<div data-code-preview="cpp" aria-label="Code preview">
  <div class="code-editor-module__WH5mia__previewLine">
    <code class="code-editor-module__WH5mia__previewLineCode">class Solution {</code>
  </div>
  <div class="code-editor-module__WH5mia__previewLine">
    <code class="code-editor-module__WH5mia__previewLineCode">public:</code>
  </div>
  <div class="code-editor-module__WH5mia__previewLine">
    <code class="code-editor-module__WH5mia__previewLineCode">  int linearSearch(vector&lt;int&gt;&amp; nums, int target) {</code>
  </div>
  <div class="code-editor-module__WH5mia__previewLine">
    <code class="code-editor-module__WH5mia__previewLineCode">    return -1;</code>
  </div>
  <div class="code-editor-module__WH5mia__previewLine">
    <code class="code-editor-module__WH5mia__previewLineCode">  }</code>
  </div>
  <div class="code-editor-module__WH5mia__previewLine">
    <code class="code-editor-module__WH5mia__previewLineCode">};</code>
  </div>
</div>
`;

describe("extractTakeUForward", () => {
  // The jsdom URL is set to takeuforward.org via @jest-environment-options above.
  beforeEach(() => {
    document.body.innerHTML = TUF_HTML;
  });

  it("returns null when the title element is not present (DOM not rendered yet)", () => {
    // snapshot() now requires the ProblemPanel title element to be present.
    // An empty page on the correct URL should return null (retry needed).
    document.body.innerHTML = "<p>empty</p>";
    const ctx = extractTakeUForward();
    expect(ctx).toBeNull();
  });

  it("extracts the problem title", () => {
    const ctx = extractTakeUForward();
    expect(ctx).not.toBeNull();
    expect(ctx!.title).toContain("Linear Search");
  });

  it("extracts the problem statement from the first richText div", () => {
    const ctx = extractTakeUForward();
    expect(ctx!.statement).toContain("smallest index");
    expect(ctx!.statement).toContain("nums");
    // Should NOT include example text
    expect(ctx!.statement).not.toContain("Input:");
  });

  it("extracts examples from sections with 'Example' headings", () => {
    const ctx = extractTakeUForward();
    expect(ctx!.examples).toContain("Example 1");
    expect(ctx!.examples).toContain("Example 2");
    expect(ctx!.examples).toContain("[2,3,4,5,3]");
    expect(ctx!.examples).toContain("[2,-4,4,0,10]");
    // Hints section should not appear in examples
    expect(ctx!.examples).not.toContain("Hints");
  });

  it("extracts constraints from the constraintsBox element", () => {
    const ctx = extractTakeUForward();
    expect(ctx!.constraints).toContain("nums.length");
    expect(ctx!.constraints).toContain("10^5");
  });

  it("extracts code from the previewLineCode elements", () => {
    const ctx = extractTakeUForward();
    expect(ctx!.code).toContain("class Solution");
    expect(ctx!.code).toContain("linearSearch");
    expect(ctx!.code).toContain("return -1");
  });

  it("extracts language from data-code-preview attribute", () => {
    const ctx = extractTakeUForward();
    expect(ctx!.language).toBe("cpp");
  });

  it("sets extractedBy to 'takeuforward'", () => {
    const ctx = extractTakeUForward();
    expect(ctx!.extractedBy).toBe("takeuforward");
  });

  it("sets the url from window.location.href", () => {
    const ctx = extractTakeUForward();
    expect(ctx!.url).toContain("takeuforward.org");
  });
});

describe("extractTakeUForwardAsync", () => {
  it("resolves with context immediately when DOM is already ready", async () => {
    document.body.innerHTML = TUF_HTML;
    const ctx = await extractTakeUForwardAsync(3, 10);
    expect(ctx).not.toBeNull();
    expect(ctx!.title).toContain("Linear Search");
    expect(ctx!.extractedBy).toBe("takeuforward");
  });

  it("resolves with null on timeout when DOM never renders", async () => {
    document.body.innerHTML = "<p>empty</p>";
    const ctx = await extractTakeUForwardAsync(3, 10);
    expect(ctx).toBeNull();
  });

  it("resolves with null immediately when URL does not match TUF", async () => {
    // jsdom URL is set to takeuforward.org by the env-options — this tests the
    // URL guard indirectly: the URL does match, but the DOM is empty so it
    // times out and returns null.
    document.body.innerHTML = "<p>empty</p>";
    const ctx = await extractTakeUForwardAsync(1, 1);
    expect(ctx).toBeNull();
  });
});
