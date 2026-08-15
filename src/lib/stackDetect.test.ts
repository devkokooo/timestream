import { describe, expect, it } from "vitest";
import { detectStacks } from "./stackDetect";
import type { PullRequestSummary } from "./types";

function pr(partial: Partial<PullRequestSummary> & Pick<PullRequestSummary, "number" | "headRef" | "baseRef">): PullRequestSummary {
  return {
    title: `PR ${partial.number}`,
    body: "",
    state: "open",
    draft: false,
    htmlUrl: "",
    headSha: "",
    userLogin: "analyst",
    mergeable: true,
    labels: [],
    requestedReviewers: [],
    ciStatus: null,
    reviewDecision: null,
    ...partial,
  };
}

describe("detectStacks", () => {
  it("chains PRs where base is the previous head", () => {
    const stacks = detectStacks([
      pr({ number: 1, headRef: "feat-a", baseRef: "main" }),
      pr({ number: 2, headRef: "feat-b", baseRef: "feat-a" }),
      pr({ number: 3, headRef: "feat-c", baseRef: "feat-b" }),
    ]);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].items.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(stacks[0].base).toBe("main");
  });

  it("ignores unrelated PRs", () => {
    const stacks = detectStacks([
      pr({ number: 1, headRef: "a", baseRef: "main" }),
      pr({ number: 2, headRef: "b", baseRef: "main" }),
    ]);
    expect(stacks).toEqual([]);
  });
});
