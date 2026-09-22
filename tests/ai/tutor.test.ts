// ─────────────────────────────────────────────────────────────────────────────
// Tests: tutor hint level helpers
// ─────────────────────────────────────────────────────────────────────────────

import { increaseHintLevel, resetHintLevel } from "../../src/ai/tutor";
import type { HintLevel } from "../../src/types";

describe("increaseHintLevel", () => {
  it("increments from 0 to 1", () => {
    expect(increaseHintLevel(0)).toBe(1);
  });

  it("increments from 2 to 3", () => {
    expect(increaseHintLevel(2)).toBe(3);
  });

  it("increments from 3 to 4", () => {
    expect(increaseHintLevel(3)).toBe(4);
  });

  it("does not exceed level 4", () => {
    expect(increaseHintLevel(4)).toBe(4);
  });
});

describe("resetHintLevel", () => {
  it("always returns 0", () => {
    expect(resetHintLevel()).toBe(0);
  });
});
