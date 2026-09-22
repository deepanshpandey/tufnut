// ─────────────────────────────────────────────────────────────────────────────
// Tests: spoiler guard
// ─────────────────────────────────────────────────────────────────────────────

import { checkForSpoilers } from "../../src/ai/spoilerGuard";

describe("checkForSpoilers", () => {
  // ── Clean responses ────────────────────────────────────────────────────────

  it("returns hasSpoiler=false for a Socratic question", () => {
    const result = checkForSpoilers(
      "What do you expect `left` to represent after the loop completes?"
    );
    expect(result.hasSpoiler).toBe(false);
  });

  it("returns hasSpoiler=false for a conceptual hint", () => {
    const result = checkForSpoilers(
      "Think about whether you can remember information from previously processed elements."
    );
    expect(result.hasSpoiler).toBe(false);
  });

  it("returns hasSpoiler=false for a short directional hint", () => {
    const result = checkForSpoilers(
      "Your current loop is repeatedly examining information you've already seen."
    );
    expect(result.hasSpoiler).toBe(false);
  });

  // ── Spoiler: large code block ──────────────────────────────────────────────

  it("detects a large fenced code block as a spoiler", () => {
    const result = checkForSpoilers(
      "Here is the approach:\n```python\ndef twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target-n], i]\n        seen[n] = i\n```"
    );
    expect(result.hasSpoiler).toBe(true);
    expect(result.reason).toContain("code block");
  });

  // ── Spoiler: tell-tale phrases ─────────────────────────────────────────────

  it("detects 'here is the solution' phrase", () => {
    const result = checkForSpoilers(
      "Here is the solution: use a hash map to store previous values."
    );
    expect(result.hasSpoiler).toBe(true);
  });

  it("detects 'the answer is' phrase", () => {
    const result = checkForSpoilers("The answer is to use two pointers.");
    expect(result.hasSpoiler).toBe(true);
  });

  it("detects 'you should use' phrase", () => {
    const result = checkForSpoilers(
      "You should use a sliding window for this problem."
    );
    expect(result.hasSpoiler).toBe(true);
  });

  it("is case-insensitive for tell-tale phrases", () => {
    const result = checkForSpoilers("HERE IS THE COMPLETE solution you need.");
    expect(result.hasSpoiler).toBe(true);
  });

  // ── Spoiler: long numbered list ────────────────────────────────────────────

  it("detects a long numbered implementation list as a spoiler", () => {
    const text = [
      "Here is the approach:",
      "1. Initialize a hash map.",
      "2. Iterate through the array.",
      "3. Check if complement exists in the map.",
      "4. If yes, return the indices.",
    ].join("\n");
    const result = checkForSpoilers(text);
    expect(result.hasSpoiler).toBe(true);
    expect(result.reason).toContain("numbered list");
  });

  it("does not flag a response with fewer numbered items", () => {
    const text = "Consider two things:\n1. What is the range of values?\n2. What structure stores lookups in O(1)?";
    const result = checkForSpoilers(text);
    expect(result.hasSpoiler).toBe(false);
  });

  // ── Spoiler: inline code with braces + semicolons ──────────────────────────

  it("detects inline code with braces AND semicolons as a spoiler", () => {
    // Guard requires BOTH { and ; in the same inline snippet
    const result = checkForSpoilers(
      "Use this: `if (map.containsKey(key)) { return map.get(key); }`"
    );
    expect(result.hasSpoiler).toBe(true);
  });

  it("does NOT flag inline code that has semicolons but no braces", () => {
    const result = checkForSpoilers(
      "Think about: `map.get(key); map.put(key, val);`"
    );
    expect(result.hasSpoiler).toBe(false);
  });
});
