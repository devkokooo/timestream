export interface PullCounts {
  open: number;
  closed: number;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  body: string;
  state: string;
  draft: boolean;
  htmlUrl: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  baseSha: string;
  userLogin: string;
  mergeable: boolean | null;
  labels: string[];
  requestedReviewers: string[];
  ciStatus: string | null;
  reviewDecision: string | null;
  createdAt: string;
}

export interface CreatePullRequest {
  title: string;
  body: string;
  head: string;
  base: string;
  draft: boolean;
}

export interface PullCommit {
  sha: string;
  shortId: string;
  summary: string;
  author: string;
  email: string;
  createdAt: string;
}

export interface PrStack {
  base: string;
  items: PullRequestSummary[];
}
