import type { IssueComment, IssueSummary, PullCommit, PullRequestSummary, PullReview, ReviewComment } from "./types";

export type DocketKind = "opened" | "incident" | "commits" | "comment" | "review" | "reviewComment";

export interface DocketCommit {
  shortId: string;
  summary: string;
  at: string;
}

export interface DocketEntry {
  kind: DocketKind;
  at: string;
  id: string;
  user: string;
  body: string;
  summary?: string;
  path?: string;
  line?: number | null;
  state?: string;
  commits?: DocketCommit[];
}

export function docketTime(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

export function includeReview(review: PullReview): boolean {
  if (review.state === "PENDING") return false;
  if (review.state === "APPROVED" || review.state === "CHANGES_REQUESTED") return true;
  return Boolean(review.body.trim());
}

export function docketAction(entry: DocketEntry): string {
  if (entry.kind === "opened") return "opened this request";
  if (entry.kind === "incident") return "opened this incident";
  if (entry.kind === "commits") {
    const count = entry.commits?.length ?? 0;
    return count === 1 ? "added 1 commit" : `added ${count} commits`;
  }
  if (entry.kind === "comment" || entry.kind === "reviewComment") return "left a comment";
  if (entry.kind === "review" && entry.state === "APPROVED") return "approved";
  if (entry.kind === "review" && entry.state === "CHANGES_REQUESTED") return "requested changes";
  if (entry.kind === "review") return "left a review";
  return "";
}

export function buildPrDocket(
  pull: PullRequestSummary,
  commits: PullCommit[],
  comments: IssueComment[],
  reviews: PullReview[],
  reviewComments: ReviewComment[],
): DocketEntry[] {
  const entries: DocketEntry[] = [
    {
      kind: "opened",
      at: pull.createdAt,
      id: `opened-${pull.number}`,
      user: pull.userLogin,
      body: pull.body,
      summary: pull.title,
    },
  ];
  for (const commit of commits) {
    entries.push({
      kind: "commits",
      at: commit.createdAt,
      id: `commit-${commit.sha}`,
      user: commit.author,
      body: "",
      commits: [{ shortId: commit.shortId, summary: commit.summary, at: commit.createdAt }],
    });
  }
  for (const comment of comments) {
    entries.push({
      kind: "comment",
      at: comment.createdAt,
      id: `comment-${comment.id}`,
      user: comment.userLogin,
      body: comment.body,
    });
  }
  for (const review of reviews) {
    if (!includeReview(review)) continue;
    entries.push({
      kind: "review",
      at: review.submittedAt,
      id: `review-${review.id}`,
      user: review.userLogin,
      body: review.body,
      state: review.state,
    });
  }
  for (const comment of reviewComments) {
    entries.push({
      kind: "reviewComment",
      at: comment.createdAt,
      id: `review-comment-${comment.id}`,
      user: comment.userLogin,
      body: comment.body,
      path: comment.path,
      line: comment.line,
    });
  }
  return collapseCommitRuns(
    entries.sort((a, b) => docketTime(a.at) - docketTime(b.at) || a.id.localeCompare(b.id)),
  );
}

export function buildIssueDocket(issue: IssueSummary, comments: IssueComment[]): DocketEntry[] {
  const entries: DocketEntry[] = [
    {
      kind: "incident",
      at: issue.createdAt,
      id: `incident-${issue.number}`,
      user: issue.userLogin,
      body: issue.body,
      summary: issue.title,
    },
  ];
  for (const comment of comments) {
    entries.push({
      kind: "comment",
      at: comment.createdAt,
      id: `comment-${comment.id}`,
      user: comment.userLogin,
      body: comment.body,
    });
  }
  return entries.sort((a, b) => docketTime(a.at) - docketTime(b.at) || a.id.localeCompare(b.id));
}

export function collapseCommitRuns(entries: DocketEntry[]): DocketEntry[] {
  const out: DocketEntry[] = [];
  for (const entry of entries) {
    const prev = out[out.length - 1];
    const nextCommits = entry.commits ?? [];
    if (entry.kind === "commits" && prev?.kind === "commits" && prev.user === entry.user) {
      prev.commits = [...(prev.commits ?? []), ...nextCommits];
      prev.at = entry.at;
      prev.id = `${prev.id}+${entry.id}`;
      continue;
    }
    out.push(entry);
  }
  return out;
}
