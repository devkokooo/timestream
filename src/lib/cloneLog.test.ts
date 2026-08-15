import { describe, expect, it } from "vitest";
import { appendCloneLog } from "./cloneLog";

describe("appendCloneLog", () => {
  it("appends distinct lines", () => {
    expect(appendCloneLog(["Cloning into 'app'..."], "Starting SSH session...")).toEqual([
      "Cloning into 'app'...",
      "Starting SSH session...",
    ]);
  });

  it("replaces the current git progress phase instead of flooding", () => {
    const once = appendCloneLog([], "Receiving objects:  10% (10/100), 4.00 KiB");
    const twice = appendCloneLog(once, "Receiving objects:  40% (40/100), 16.00 KiB");
    expect(twice).toEqual(["Receiving objects:  40% (40/100), 16.00 KiB"]);
  });

  it("keeps sideband lines when the phase changes", () => {
    const lines = appendCloneLog(
      ["Receiving objects: 100% (100/100), 32.00 KiB"],
      "Resolving deltas:  50% (10/20)",
    );
    expect(lines).toHaveLength(2);
  });

  it("caps history", () => {
    const many = Array.from({ length: 10 }, (_, i) => `line ${i}`);
    const next = appendCloneLog(many, "line 10", 5);
    expect(next).toEqual(["line 6", "line 7", "line 8", "line 9", "line 10"]);
  });
});
