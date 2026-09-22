// ─────────────────────────────────────────────────────────────────────────────
// Tests: AI prompts builder
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildSystemPrompt,
  buildHintLevelInstruction,
  TUTOR_PERSONA,
} from "../../src/ai/prompts";
import type { ProblemContext, ChatMessage } from "../../src/types";

describe("buildHintLevelInstruction", () => {
  it("returns level-0 instruction for hint level 0", () => {
    const instruction = buildHintLevelInstruction(0);
    expect(instruction).toContain("Socratic");
    expect(instruction).toContain("level: 0");
  });

  it("returns level-3 instruction for hint level 3", () => {
    const instruction = buildHintLevelInstruction(3);
    expect(instruction).toContain("Strong Hint");
  });

  it("returns level-4 instruction for hint level 4", () => {
    const instruction = buildHintLevelInstruction(4);
    expect(instruction).toContain("Confirmation");
  });
});

describe("buildSystemPrompt", () => {
  const fakeProblem: ProblemContext = {
    title:       "Two Sum",
    statement:   "Given an array of integers, find two numbers that add up to target.",
    examples:    "Input: [2,7,11,15], target=9. Output: [0,1]",
    constraints: "1 <= nums.length <= 10^4",
    code:        "function twoSum(nums, target) {\n  // TODO\n}",
    language:    "javascript",
    url:         "https://leetcode.com/problems/two-sum/",
  };

  it("includes the tutor persona", () => {
    const prompt = buildSystemPrompt({
      problem:             fakeProblem,
      userApproach:        "",
      hintLevel:           0,
      conversationHistory: [],
    });
    expect(prompt).toContain("Tufnut");
    expect(prompt).toContain("NEVER provide the final solution");
  });

  it("includes the problem title and statement", () => {
    const prompt = buildSystemPrompt({
      problem:             fakeProblem,
      userApproach:        "",
      hintLevel:           0,
      conversationHistory: [],
    });
    expect(prompt).toContain("Two Sum");
    expect(prompt).toContain("find two numbers");
  });

  it("includes the user's code", () => {
    const prompt = buildSystemPrompt({
      problem:             fakeProblem,
      userApproach:        "",
      hintLevel:           0,
      conversationHistory: [],
    });
    expect(prompt).toContain("function twoSum");
    expect(prompt).toContain("javascript");
  });

  it("includes user's approach when provided", () => {
    const prompt = buildSystemPrompt({
      problem:             fakeProblem,
      userApproach:        "I think I should use two pointers",
      hintLevel:           0,
      conversationHistory: [],
    });
    expect(prompt).toContain("two pointers");
  });

  it("includes recent hint summary from conversation history", () => {
    const history: ChatMessage[] = [
      { role: "user",      content: "Help me",               timestamp: 0 },
      { role: "assistant", content: "What is your approach?", timestamp: 1 },
    ];
    const prompt = buildSystemPrompt({
      problem:             fakeProblem,
      userApproach:        "",
      hintLevel:           0,
      conversationHistory: history,
    });
    expect(prompt).toContain("Recent hints");
    expect(prompt).toContain("What is your approach?");
  });

  it("works when problem is null", () => {
    const prompt = buildSystemPrompt({
      problem:             null,
      userApproach:        "",
      hintLevel:           0,
      conversationHistory: [],
    });
    expect(prompt).toContain("Tufnut");
    // Should not throw and should not reference undefined problem fields
    expect(prompt).not.toContain("undefined");
  });
});

describe("TUTOR_PERSONA", () => {
  it("explicitly forbids providing complete solution code", () => {
    expect(TUTOR_PERSONA).toContain("NEVER provide complete solution code");
  });

  it("explicitly requires asking questions over giving answers", () => {
    // The persona says "Prefer a single well-chosen question over a long explanation"
    expect(TUTOR_PERSONA).toContain("Prefer a single well-chosen question");
  });
});
