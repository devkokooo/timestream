import { describe, expect, it } from "vitest";
import { buildIssueDocket, buildPrDocket, docketAction, includeReview } from "./prDocket";
import type { IssueComment, IssueSummary, PullCommit, PullRequestSummary, PullReview, ReviewComment } from "./types";

function pull(partial: Partial<PullRequestSummary> = {}): PullRequestSummary {
  return {
    number: 12,
    title: "Fix river",
    body: "Keep it gold.",
    state: "open",
    draft: false,
    htmlUrl: "",
    headRef: "feature",
    headSha: "aaa",
    baseRef: "main",
    baseSha: "bbb",
    userLogin: "analyst",
    mergeable: true,
    labels: [],
    requestedReviewers: [],
    ciStatus: null,
    reviewDecision: null,
    createdAt: "2026-08-16T10:00:00Z",
    ...partial,
  };
}

describe("buildPrDocket", () => {
  it("orders opened, commits, and comments by time", () => {
    const commits: PullCommit[] = [
      { sha: "c2", shortId: "c2", summary: "later tip", author: "analyst", email: "analyst@tva.local", createdAt: "2026-08-16T12:00:00Z" },
      { sha: "c1", shortId: "c1", summary: "first spur", author: "analyst", email: "analyst@tva.local", createdAt: "2026-08-16T11:00:00Z" },
    ];
    const comments: IssueComment[] = [
      { id: 2, userLogin: "reviewer", body: "second note", createdAt: "2026-08-16T13:00:00Z" },
      { id: 1, userLogin: "reviewer", body: "first note", createdAt: "2026-08-16T11:30:00Z" },
    ];
    const reviewComments: ReviewComment[] = [
      {
        id: 9,
        path: "keep.txt",
        line: 4,
        originalLine: 4,
        side: "RIGHT",
        body: "line note",
        userLogin: "reviewer",
        diffHunk: null,
        inReplyToId: null,
        createdAt: "2026-08-16T12:30:00Z",
      },
    ];
    const reviews: PullReview[] = [
      { id: 3, userLogin: "reviewer", body: "Clear.", state: "APPROVED", submittedAt: "2026-08-16T14:00:00Z" },
    ];
    const docket = buildPrDocket(pull(), commits, comments, reviews, reviewComments);
    expect(docket.map((item) => item.kind)).toEqual([
      "opened",
      "commits",
      "comment",
      "commits",
      "reviewComment",
      "comment",
      "review",
    ]);
    expect(docket[1].commits?.map((item) => item.summary)).toEqual(["first spur"]);
    expect(docket[1].email).toBe("analyst@tva.local");
    expect(docket[3].commits?.map((item) => item.summary)).toEqual(["later tip"]);
  });

  it("groups consecutive commits from the same author", () => {
    const docket = buildPrDocket(
      pull(),
      [
        { sha: "a", shortId: "a", summary: "one", author: "analyst", email: "analyst@tva.local", createdAt: "2026-08-16T11:00:00Z" },
        { sha: "b", shortId: "b", summary: "two", author: "analyst", email: "analyst@tva.local", createdAt: "2026-08-16T11:05:00Z" },
        { sha: "c", shortId: "c", summary: "three", author: "other", email: "other@tva.local", createdAt: "2026-08-16T11:10:00Z" },
      ],
      [],
      [],
      [],
    );
    expect(docket.filter((item) => item.kind === "commits")).toHaveLength(2);
    expect(docketAction(docket[1])).toBe("added 2 commits");
    expect(docketAction(docket[2])).toBe("added 1 commit");
  });

  it("names conversation actions", () => {
    expect(docketAction({ kind: "opened", at: "", id: "o", user: "a", body: "" })).toBe("opened this request");
    expect(docketAction({ kind: "incident", at: "", id: "i", user: "a", body: "" })).toBe("opened this incident");
    expect(docketAction({ kind: "comment", at: "", id: "c", user: "a", body: "" })).toBe("left a comment");
    expect(docketAction({ kind: "review", at: "", id: "r", user: "a", body: "", state: "APPROVED" })).toBe("approved");
    expect(
      docketAction({ kind: "review", at: "", id: "r", user: "a", body: "", state: "CHANGES_REQUESTED" }),
    ).toBe("requested changes");
  });

  it("drops pending and empty comment reviews", () => {
    expect(includeReview({ id: 1, userLogin: "a", body: "", state: "PENDING", submittedAt: "" })).toBe(false);
    expect(includeReview({ id: 2, userLogin: "a", body: "", state: "COMMENTED", submittedAt: "" })).toBe(false);
    expect(includeReview({ id: 3, userLogin: "a", body: "", state: "APPROVED", submittedAt: "" })).toBe(true);
  });
});

describe("buildIssueDocket", () => {
  it("orders the incident and comments by time", () => {
    const issue: IssueSummary = {
      number: 4,
      title: "River leak",
      body: "Keep the gold.",
      state: "open",
      htmlUrl: "",
      userLogin: "analyst",
      labels: [],
      assignees: [],
      milestone: null,
      pullRequest: false,
      createdAt: "2026-08-16T10:00:00Z",
    };
    const comments: IssueComment[] = [
      { id: 2, userLogin: "reviewer", body: "second note", createdAt: "2026-08-16T12:00:00Z" },
      { id: 1, userLogin: "reviewer", body: "first note", createdAt: "2026-08-16T11:00:00Z" },
    ];
    const docket = buildIssueDocket(issue, comments);
    expect(docket.map((item) => item.kind)).toEqual(["incident", "comment", "comment"]);
    expect(docket[0].summary).toBe("River leak");
    expect(docket[1].body).toBe("first note");
    expect(docket[2].body).toBe("second note");
  });
});
