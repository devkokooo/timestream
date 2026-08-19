import { describe, expect, it } from "vitest";
import type { StatusPayload } from "@/worktree/types";
import {
  firstWorktreeTarget,
  followWorktreeTarget,
  statusFile,
  targetsEqual,
  type DiffTarget,
} from "./targets";

const file = (path: string) => ({
  path,
  oldPath: null,
  status: "modified",
});

const status = (partial: Partial<StatusPayload> = {}): StatusPayload => ({
  staged: [],
  unstaged: [],
  untracked: [],
  ...partial,
});

describe("worktree diff targets", () => {
  it("picks the first unstaged path", () => {
    const next = status({ unstaged: [file("a.ts")], staged: [file("b.ts")] });
    expect(firstWorktreeTarget(next)).toEqual({ kind: "unstaged", path: "a.ts" });
  });

  it("follows a file that moved staged → unstaged", () => {
    const target: DiffTarget = { kind: "staged", path: "a.ts" };
    const next = status({ unstaged: [file("a.ts")] });
    expect(followWorktreeTarget(next, target)).toEqual({ kind: "unstaged", path: "a.ts" });
    expect(statusFile(next, target)).toBeNull();
  });

  it("compares targets by kind and path", () => {
    expect(targetsEqual({ kind: "commit", path: "a" }, { kind: "commit", path: "a" })).toBe(true);
    expect(targetsEqual({ kind: "staged", path: "a" }, { kind: "unstaged", path: "a" })).toBe(false);
    expect(targetsEqual(null, null)).toBe(true);
  });
});
