import { describe, expect, it } from "vitest";
import { canReviseLastFiling } from "./amendFiling";
import type { AheadBehind } from "./types";

function sync(partial: Partial<AheadBehind>): AheadBehind {
  return { ahead: 0, behind: 0, upstream: null, ...partial };
}

describe("canReviseLastFiling", () => {
  it("is false without HEAD", () => {
    expect(canReviseLastFiling(null, true, false)).toBe(false);
  });

  it("is false on detached HEAD", () => {
    expect(canReviseLastFiling(sync({ upstream: null }), false, true)).toBe(false);
  });

  it("is true when there is no upstream", () => {
    expect(canReviseLastFiling(null, true, true)).toBe(true);
    expect(canReviseLastFiling(sync({ upstream: null, ahead: 0 }), true, true)).toBe(true);
  });

  it("is true when HEAD is ahead of upstream", () => {
    expect(canReviseLastFiling(sync({ upstream: "origin/main", ahead: 1 }), true, true)).toBe(
      true,
    );
  });

  it("is false when HEAD matches upstream", () => {
    expect(canReviseLastFiling(sync({ upstream: "origin/main", ahead: 0 }), true, true)).toBe(
      false,
    );
  });
});
