/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://leetcode.com/problems/two-sum/"}
 */
// tests/content/leetcode.test.ts
// Unit tests for the LeetCode problem extractor.

import { extractLeetCode } from "../../src/content/extractors/leetcode";

// ── DOM helper ────────────────────────────────────────────────────────────────

function setDom(html: string) {
  document.body.innerHTML = html;
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_PAGE = `
  <h1 class="text-title-large">1. Two Sum</h1>
  <div data-track-load="description_content">
    Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

    Example 1:
    Input: nums = [2,7,11,15], target = 9
    Output: [0,1]

    Constraints:
    2 &lt;= nums.length &lt;= 10^4
  </div>
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("extractLeetCode — URL guard", () => {
  it("returns a result on a LeetCode URL (jsdom env is leetcode.com)", () => {
    setDom(FULL_PAGE);
    // The jsdom URL is leetcode.com so the extractor should NOT return null
    expect(extractLeetCode()).not.toBeNull();
  });
});

describe("extractLeetCode — title extraction", () => {
  it("extracts title from h1.text-title-large", () => {
    setDom(FULL_PAGE);
    const result = extractLeetCode();
    expect(result?.title).toContain("Two Sum");
  });

  it("falls back to bare h1 when class variant is absent", () => {
    setDom(`
      <h1>Two Sum</h1>
      <div data-track-load="description_content">Some problem. Example 1: foo</div>
    `);
    const result = extractLeetCode();
    expect(result?.title).toBe("Two Sum");
  });

  it("falls back to data-cy selector", () => {
    setDom(`<h4 data-cy="question-title">3. Longest Substring</h4>`);
    const result = extractLeetCode();
    expect(result?.title).toBe("3. Longest Substring");
  });
});

describe("extractLeetCode — description parsing", () => {
  it("splits statement / examples / constraints correctly", () => {
    setDom(FULL_PAGE);
    const result = extractLeetCode();
    expect(result?.statement).toMatch(/array of integers/);
    expect(result?.examples).toMatch(/Example 1/);
    expect(result?.constraints).toMatch(/Constraints/);
  });

  it("puts everything into statement when no Example section present", () => {
    setDom(`
      <h1>Foo</h1>
      <div data-track-load="description_content">Just a plain statement with no examples.</div>
    `);
    const result = extractLeetCode();
    expect(result?.statement).toMatch(/plain statement/);
    expect(result?.examples).toBeUndefined();
    expect(result?.constraints).toBeUndefined();
  });

  it("captures constraints even without examples section", () => {
    setDom(`
      <h1>Bar</h1>
      <div data-track-load="description_content">
        Some description with Example 1: x=1. Constraints: n &gt;= 1
      </div>
    `);
    const result = extractLeetCode();
    expect(result?.constraints).toMatch(/Constraints/);
  });
});

describe("extractLeetCode — metadata", () => {
  it("sets extractedBy to leetcode", () => {
    setDom(FULL_PAGE);
    expect(extractLeetCode()?.extractedBy).toBe("leetcode");
  });

  it("sets url to window.location.href (leetcode.com jsdom environment)", () => {
    setDom(FULL_PAGE);
    expect(extractLeetCode()?.url).toContain("leetcode.com");
  });
});

describe("extractLeetCode — fallback description selector", () => {
  it("reads from .elfjS when data-track-load is absent", () => {
    setDom(`
      <h1>Test</h1>
      <div class="elfjS">Desc text. Example 1: y. Constraints: k&gt;0</div>
    `);
    const result = extractLeetCode();
    expect(result?.statement).toMatch(/Desc text/);
  });
});

describe("extractLeetCode — empty DOM", () => {
  it("returns null when neither title nor description is found", () => {
    setDom("<div>completely unrelated content with no headings</div>");
    expect(extractLeetCode()).toBeNull();
  });
});
