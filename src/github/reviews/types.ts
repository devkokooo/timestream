export interface ReviewComment {
  id: number;
  path: string;
  line: number | null;
  originalLine: number | null;
  side: string | null;
  body: string;
  userLogin: string;
  diffHunk: string | null;
  inReplyToId: number | null;
  createdAt: string;
}

export interface PullReview {
  id: number;
  userLogin: string;
  body: string;
  state: string;
  submittedAt: string;
}

export interface PendingReviewComment {
  path: string;
  body: string;
  line: number;
  side: string;
}

export interface SubmitReview {
  body: string;
  event: string;
  comments: PendingReviewComment[];
}
