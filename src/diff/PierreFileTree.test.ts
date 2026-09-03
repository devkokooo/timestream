import { describe, expect, it } from "vitest";
import { gitStatusForFileStatus } from "@/diff/PierreFileTree";

describe("gitStatusForFileStatus", () => {
  it.each([
    ["modified", "modified"],
    ["added", "added"],
    ["untracked", "untracked"],
    ["deleted", "deleted"],
    ["moved", "renamed"],
    ["copied", "renamed"],
    ["renamed", "renamed"],
  ] as const)("maps %s -> %s", (input, expected) => {
    expect(gitStatusForFileStatus(input)).toBe(expected);
  });

  it("falls back to modified for unknown statuses", () => {
    expect(gitStatusForFileStatus("wat")).toBe("modified");
  });
});

