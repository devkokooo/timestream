import { describe, expect, it } from "vitest";
import { linearTimeline, manyBranchesTimeline } from "@/timeline/fixtures";
import {
  branchChoices,
  compareSpecs,
  githubRefName,
  groupLedgerByDay,
  ledgerDayHeading,
  ledgerWhen,
  matchingPull,
  orderLedgerCommits,
  sameGitRef,
} from "./prRefs";
import { formatLocalDateTime } from "@/ui/relativeTime";
import type { PullRequestSummary } from "./types";

function localStamp(year: number, month: number, day: number, hour: number): number {
  return Math.floor(new Date(year, month - 1, day, hour).getTime() / 1000);
}

function pr(
  partial: Partial<PullRequestSummary> & Pick<PullRequestSummary, "number" | "headRef" | "baseRef">,
): PullRequestSummary {
  return {
    title: `PR ${partial.number}`,
    body: "",
    state: "open",
    draft: false,
    htmlUrl: "",
    headSha: "",
    userLogin: "analyst",
    baseSha: "",
    mergeable: true,
    labels: [],
    requestedReviewers: [],
    ciStatus: null,
    reviewDecision: null,
    createdAt: "",
    ...partial,
  };
}

describe("prCompare", () => {
  it("strips origin/ for GitHub ref names", () => {
    expect(githubRefName("origin/feature")).toBe("feature");
    expect(githubRefName("feature")).toBe("feature");
  });

  it("treats origin-prefixed refs as the same sequence", () => {
    expect(sameGitRef("origin/main", "main")).toBe(true);
    expect(sameGitRef("feature", "other")).toBe(false);
  });

  it("matches an open request by from/into refs", () => {
    const prs = [
      pr({ number: 1, headRef: "feature", baseRef: "main" }),
      pr({ number: 2, headRef: "other", baseRef: "main" }),
    ];
    expect(matchingPull(prs, "origin/feature", "main")?.number).toBe(1);
    expect(matchingPull(prs, "feature", "develop")).toBeUndefined();
  });

  it("uses recorded SHAs when the selected request matches the pickers", () => {
    const selected = pr({
      number: 1,
      headRef: "feature",
      baseRef: "main",
      headSha: "aaa",
      baseSha: "bbb",
    });
    expect(compareSpecs(selected, "origin/feature", "main")).toEqual({ head: "aaa", base: "bbb" });
    expect(compareSpecs(selected, "other", "main")).toEqual({ head: "other", base: "main" });
  });

  it("labels ledger events with a relative committed time", () => {
    const now = Date.parse("2026-08-16T20:00:00Z");
    const when = ledgerWhen(Date.parse("2026-08-16T10:00:00Z") / 1000, now);
    expect(when.label).toBe("committed 10 hours ago");
    expect(when.absolute).toBe(formatLocalDateTime(when.iso));
  });

  it("groups ledger events by local calendar day", () => {
    const dayOneMorning = localStamp(2026, 8, 15, 9);
    const dayOneNight = localStamp(2026, 8, 15, 22);
    const dayTwo = localStamp(2026, 8, 16, 8);
    const groups = groupLedgerByDay([
      { id: "c", timestamp: dayTwo, summary: "next day" },
      { id: "b", timestamp: dayOneNight, summary: "later same day" },
      { id: "a", timestamp: dayOneMorning, summary: "first spur" },
    ]);
    expect(groups.map((group) => group.commits.map((item) => item.summary))).toEqual([
      ["first spur", "later same day"],
      ["next day"],
    ]);
    expect(groups[0].heading).toBe(ledgerDayHeading(dayOneMorning));
    expect(groups[0].heading).toMatch(/^Commits on /);
    expect(groups[1].heading).toBe(ledgerDayHeading(dayTwo));
  });

  it("orders the ledger from earliest event to latest", () => {
    const commits = [
      { id: "b", timestamp: 20, summary: "later tip" },
      { id: "a", timestamp: 10, summary: "first spur" },
    ];
    expect(orderLedgerCommits(commits).map((item) => item.summary)).toEqual([
      "first spur",
      "later tip",
    ]);
  });

  it("lists local variants plus extras for the compare pickers", () => {
    const names = branchChoices(manyBranchesTimeline(3), ["main", "origin/hotfix", null]);
    expect(names).toContain("main");
    expect(names).toContain("var-1");
    expect(names).toContain("origin/hotfix");
    expect(branchChoices(linearTimeline(), [])).toEqual(["main"]);
  });
});
